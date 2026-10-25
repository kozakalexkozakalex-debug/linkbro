"use server";

// Outreach для всей команды: письмо посреднику (со сделкой или без), рассылка по нескольким сделкам,
// прочитано/не прочитано, привязка письма к сделке.
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { credsOf, send, sendMany, type MailAccount } from "@/lib/mail/client";
import { markReplied } from "@/lib/mail/sync";
import { emailOf, EMAIL_RE } from "@/lib/outreach";
import { priceAction, type Channel } from "../projects/deal-actions";

type Ok = { ok: true } | { ok: false; error: string };
type Donor = { id: string; project_id: string; domain: string; med_base: string; indicator: string | null; comm_status: string; core_status: string };
const DONOR = "id, project_id, domain, med_base, indicator, comm_status, core_status";
const ACC_COLS = "user_id, team_id, email, imap_host, imap_port, smtp_host, smtp_port, secret, last_uid";
const CHANNELS: Channel[] = ["email", "telegram", "whatsapp", "exchange", "call", "note"];
const BULK_MAX = 15; // писем за один вызов (браузер шлёт порциями — успеваем до таймаута сервера)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markSent(supabase: any, teamId: string, d: Donor) {
  if (d.indicator === "replied") return;
  const patch: Record<string, unknown> = { indicator: "waiting", indicator_at: new Date().toISOString(), in_comm: true };
  if (!d.comm_status) patch.comm_status = "Contacted";
  if (["new_core", "OK_Cat", ""].includes(d.core_status)) patch.core_status = "In communication";
  await supabase.from("project_donors").update(patch).eq("id", d.id).eq("team_id", teamId);
}

async function myAccount() {
  const ctx = await getTeamContext();
  const { data } = await ctx.supabase.from("mail_accounts").select(ACC_COLS).eq("user_id", ctx.user.id).maybeSingle();
  return { ...ctx, acc: (data as MailAccount | null) ?? null };
}

// Письмо посреднику со страницы контакта. donorId — к какой сделке относится (можно без сделки).
export async function sendContactEmail(input: { handle: string; donorId: string | null; to: string; subject: string; body: string; inReplyTo?: string }): Promise<Ok> {
  const { supabase, team, acc } = await myAccount();
  const { t } = await getI18n();
  if (!acc) return { ok: false, error: t("mail.notConnected") };
  const to = input.to.trim();
  if (!EMAIL_RE.test(to)) return { ok: false, error: t("mail.errTo") };
  if (!input.body.trim()) return { ok: false, error: t("out.errEmpty") };
  let donor: Donor | null = null;
  if (input.donorId) {
    const { data } = await supabase.from("project_donors").select(DONOR).eq("id", input.donorId).eq("team_id", team.id).maybeSingle();
    donor = data as Donor | null;
    if (!donor) return { ok: false, error: t("err.donorNotFound") };
  }
  let messageId = "";
  try {
    messageId = await send(credsOf(acc), to, input.subject.slice(0, 300), input.body.slice(0, 20000), input.inReplyTo ?? "");
  } catch (e) {
    return { ok: false, error: t("mail.errSend", { x: e instanceof Error ? e.message : String(e) }) };
  }
  const { error } = await supabase.from("activities").insert({
    team_id: team.id,
    project_id: donor?.project_id ?? null,
    donor_id: donor?.id ?? null,
    handle: donor?.med_base || input.handle.trim(),
    channel: "email",
    direction: "out",
    subject: input.subject.slice(0, 500),
    body: input.body.slice(0, 4000),
    message_id: messageId,
    is_read: true,
  });
  if (error) return { ok: false, error: error.message };
  if (donor) await markSent(supabase, team.id, donor);
  return { ok: true };
}

// Запись о сообщении в Telegram / WhatsApp / на бирже со страницы контакта
export async function logContactMessage(input: { handle: string; donorId: string | null; channel: Channel; direction: "in" | "out"; body: string }): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  if (!CHANNELS.includes(input.channel)) return { ok: false, error: t("err.unknownValue") };
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { ok: false, error: t("out.errEmpty") };
  let donor: Donor | null = null;
  if (input.donorId) {
    const { data } = await supabase.from("project_donors").select(DONOR).eq("id", input.donorId).eq("team_id", team.id).maybeSingle();
    donor = data as Donor | null;
    if (!donor) return { ok: false, error: t("err.donorNotFound") };
  }
  const { error } = await supabase.from("activities").insert({
    team_id: team.id,
    project_id: donor?.project_id ?? null,
    donor_id: donor?.id ?? null,
    handle: donor?.med_base || input.handle.trim(),
    channel: input.channel,
    direction: input.direction,
    body,
    is_read: true,
  });
  if (error) return { ok: false, error: error.message };
  if (donor && input.channel !== "note") {
    if (input.direction === "in") await markReplied(supabase, team.id, donor);
    else await markSent(supabase, team.id, donor);
  }
  return { ok: true };
}

// Рассылка: одно письмо (уже с подставленными переменными) на каждую выбранную сделку
export type BulkItem = { donorId: string; subject: string; body: string };
export type BulkResult = { sent: number; failed: { donorId: string; error: string }[]; error?: string };

export async function sendBulk(items: BulkItem[]): Promise<BulkResult> {
  const { supabase, team, acc } = await myAccount();
  const { t } = await getI18n();
  if (!acc) return { sent: 0, failed: [], error: t("mail.notConnected") };
  const list = items.slice(0, BULK_MAX).filter((i) => i.body.trim());
  if (!list.length) return { sent: 0, failed: [] };
  const { data: dd } = await supabase.from("project_donors").select(DONOR).eq("team_id", team.id).in("id", list.map((i) => i.donorId));
  const donors = new Map(((dd ?? []) as Donor[]).map((d) => [d.id, d]));
  const handles = [...new Set([...donors.values()].map((d) => d.med_base.trim()).filter(Boolean))];
  const { data: cc } = handles.length ? await supabase.from("contacts").select("handle, email").eq("team_id", team.id).in("handle", handles) : { data: [] };
  const mailOf = new Map(((cc ?? []) as { handle: string; email: string }[]).map((c) => [c.handle, c.email]));

  const failed: BulkResult["failed"] = [];
  const ready: { item: BulkItem; donor: Donor; to: string }[] = [];
  for (const item of list) {
    const donor = donors.get(item.donorId);
    if (!donor) { failed.push({ donorId: item.donorId, error: t("err.donorNotFound") }); continue; }
    const to = emailOf(donor.med_base, mailOf.get(donor.med_base.trim()));
    if (!to) { failed.push({ donorId: item.donorId, error: t("out.noEmail") }); continue; }
    ready.push({ item, donor, to });
  }
  let res: { messageId: string; error: string }[] = [];
  try {
    res = await sendMany(credsOf(acc), ready.map((r) => ({ to: r.to, subject: r.item.subject.slice(0, 300), text: r.item.body.slice(0, 20000) })));
  } catch (e) {
    return { sent: 0, failed, error: t("mail.errSend", { x: e instanceof Error ? e.message : String(e) }) };
  }
  const rows: Record<string, unknown>[] = [];
  let sent = 0;
  for (let i = 0; i < ready.length; i++) {
    const r = ready[i];
    if (res[i]?.error) { failed.push({ donorId: r.donor.id, error: res[i].error }); continue; }
    sent++;
    rows.push({
      team_id: team.id,
      project_id: r.donor.project_id,
      donor_id: r.donor.id,
      handle: r.donor.med_base,
      channel: "email",
      direction: "out",
      subject: r.item.subject.slice(0, 500),
      body: r.item.body.slice(0, 4000),
      message_id: res[i]?.messageId ?? "",
      is_read: true,
    });
  }
  if (rows.length) await supabase.from("activities").insert(rows);
  await Promise.all(ready.filter((_, i) => !res[i]?.error).map((r) => markSent(supabase, team.id, r.donor)));
  return { sent, failed };
}

// Прочитано: вся переписка с контактом / вообще всё
export async function markHandleRead(handle: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  await supabase.from("activities").update({ is_read: true }).eq("team_id", team.id).eq("handle", handle).eq("is_read", false);
  return { ok: true };
}

export async function markAllRead(): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  await supabase.from("activities").update({ is_read: true }).eq("team_id", team.id).eq("is_read", false);
  return { ok: true };
}

// Письмо пришло «без сделки» — привязать к нужной (сделка станет «Відповіли»)
export async function attachActivity(activityId: string, donorId: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const [{ data: a }, { data: d }] = await Promise.all([
    supabase.from("activities").select("id, direction").eq("id", activityId).eq("team_id", team.id).maybeSingle(),
    supabase.from("project_donors").select(DONOR).eq("id", donorId).eq("team_id", team.id).maybeSingle(),
  ]);
  const donor = d as Donor | null;
  if (!a || !donor) return { ok: false, error: t("err.donorNotFound") };
  const { error } = await supabase.from("activities").update({ donor_id: donor.id, project_id: donor.project_id }).eq("id", activityId).eq("team_id", team.id);
  if (error) return { ok: false, error: error.message };
  if ((a as { direction: string }).direction === "in") await markReplied(supabase, team.id, donor);
  return { ok: true };
}

// ---------- Один лист посереднику на кілька доменів ----------

export type MailGroup = { handle: string; email: string; donors: { id: string; domain: string; project_id: string }[] };

// Выделенные сделки → группы по посреднику (кому, какие домены). Без посредника — отдельно.
export async function prepareGroupMail(donorIds: string[]): Promise<{ groups: MailGroup[]; noContact: string[]; mail: string | null; templates: { id: string; name: string; body: string }[] }> {
  const { supabase, team, acc } = await myAccount();
  const [{ data: dd }, { data: tp }] = await Promise.all([
    supabase.from("project_donors").select("id, domain, project_id, med_base").eq("team_id", team.id).in("id", donorIds.slice(0, 200)),
    supabase.from("templates").select("id, name, body").eq("team_id", team.id).eq("kind", "message").order("name"),
  ]);
  const deals = (dd ?? []) as { id: string; domain: string; project_id: string; med_base: string }[];
  const handles = [...new Set(deals.map((d) => d.med_base.trim()).filter(Boolean))];
  const { data: cc } = handles.length ? await supabase.from("contacts").select("handle, email").eq("team_id", team.id).in("handle", handles) : { data: [] };
  const mailOf = new Map(((cc ?? []) as { handle: string; email: string }[]).map((c) => [c.handle, c.email]));
  const groups = new Map<string, MailGroup>();
  const noContact: string[] = [];
  for (const d of deals) {
    const h = d.med_base.trim();
    if (!h) {
      noContact.push(d.domain);
      continue;
    }
    if (!groups.has(h)) groups.set(h, { handle: h, email: emailOf(h, mailOf.get(h)), donors: [] });
    groups.get(h)!.donors.push({ id: d.id, domain: d.domain, project_id: d.project_id });
  }
  return { groups: [...groups.values()], noContact, mail: acc?.email ?? null, templates: (tp ?? []) as { id: string; name: string; body: string }[] };
}

// Одно письмо на посредника; в базе — одна запись, привязанная ко всем его сделкам (donor_ids)
export async function sendGroupMail(items: { handle: string; to: string; subject: string; body: string; donorIds: string[] }[]): Promise<{ sent: number; failed: { handle: string; error: string }[]; error?: string }> {
  const { supabase, team, acc } = await myAccount();
  const { t } = await getI18n();
  if (!acc) return { sent: 0, failed: [], error: t("mail.notConnected") };
  const list = items.slice(0, BULK_MAX).filter((i) => i.body.trim() && i.donorIds.length);
  const failed: { handle: string; error: string }[] = [];
  const ready = list.filter((i) => {
    if (EMAIL_RE.test(i.to.trim())) return true;
    failed.push({ handle: i.handle, error: t("out.noEmail") });
    return false;
  });
  if (!ready.length) return { sent: 0, failed };
  const allIds = ready.flatMap((r) => r.donorIds);
  const { data: dd } = await supabase.from("project_donors").select(DONOR).eq("team_id", team.id).in("id", allIds);
  const donors = new Map(((dd ?? []) as Donor[]).map((d) => [d.id, d]));
  const res = await sendMany(credsOf(acc), ready.map((r) => ({ to: r.to.trim(), subject: r.subject.slice(0, 300), text: r.body.slice(0, 20000) })));
  let sent = 0;
  for (let i = 0; i < ready.length; i++) {
    const r = ready[i];
    if (res[i]?.error) {
      failed.push({ handle: r.handle, error: res[i].error });
      continue;
    }
    const mine = r.donorIds.map((id) => donors.get(id)).filter((d): d is Donor => !!d);
    if (!mine.length) continue;
    sent++;
    await supabase.from("activities").insert({
      team_id: team.id,
      project_id: mine[0].project_id,
      donor_id: mine.length === 1 ? mine[0].id : null,
      donor_ids: mine.map((d) => d.id),
      handle: r.handle,
      channel: "email",
      direction: "out",
      subject: r.subject.slice(0, 500),
      body: r.body.slice(0, 4000),
      message_id: res[i]?.messageId ?? "",
      is_read: true,
    });
    await Promise.all(mine.map((d) => markSent(supabase, team.id, d)));
  }
  return { sent, failed };
}

// «Розкласти ціни по угодах»: из одного ответа посредника — его цена в историю каждой сделки
export async function splitPrices(input: { projectIds: Record<string, string>; items: { donorId: string; price: string; currency: string }[]; activityId?: string }): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const items = input.items.filter((i) => i.price.trim()).slice(0, 100);
  if (!items.length) return { ok: false, error: t("err.needNumber") };
  for (const it of items) {
    const r = await priceAction({ projectId: input.projectIds[it.donorId] ?? "", donorId: it.donorId, action: "quote", amount: it.price, currency: it.currency, note: t("out.fromReply") });
    if (!r.ok) return r;
  }
  // Ответ теперь относится ко всем этим сделкам и отмечает их «Відповіли»
  if (input.activityId) {
    const { data: a } = await supabase.from("activities").select("donor_ids, donor_id").eq("id", input.activityId).eq("team_id", team.id).maybeSingle();
    const cur = (a as { donor_ids: string[]; donor_id: string | null } | null) ?? { donor_ids: [], donor_id: null };
    const ids = [...new Set([...(cur.donor_ids ?? []), ...(cur.donor_id ? [cur.donor_id] : []), ...items.map((i) => i.donorId)])];
    await supabase.from("activities").update({ donor_ids: ids }).eq("id", input.activityId).eq("team_id", team.id);
    const { data: dd } = await supabase.from("project_donors").select(DONOR).eq("team_id", team.id).in("id", items.map((i) => i.donorId));
    await Promise.all(((dd ?? []) as Donor[]).filter((d) => d.indicator !== "replied").map((d) => markReplied(supabase, team.id, d)));
  }
  return { ok: true };
}
