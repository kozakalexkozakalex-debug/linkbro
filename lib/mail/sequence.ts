// Автоматические последовательности писем (кампании). Запускается фоновой задачей каждые 15 минут
// после проверки почты — значит, ответы уже учтены и цепочки ответивших остановлены.
//   шаг 0 → письмо 1 · шаг 1 → напоминание 1 (через step2_days) · шаг 2 → напоминание 2 (через step3_days)
//   шаг 3 и снова тишина через step3_days → сделка «Відсіяні» с причиной «Немає відповіді».
// Одно письмо на посредника за шаг (все его домены списком). Лимит писем в день на ящик.
import { credsOf, sendMany, type MailAccount } from "@/lib/mail/client";
import { emailOf, fillGroupTemplate } from "@/lib/outreach";
import { stageOf } from "@/lib/stages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
type Camp = { id: string; project_id: string; name: string; subject: string; template: string; step2_days: number; step2_body: string; step3_days: number; step3_body: string; daily_limit: number };
type Deal = { id: string; project_id: string; domain: string; med_base: string; stage: string; core_status: string; indicator: string | null; comm_status: string; seq_campaign_id: string; seq_step: number };

const DAY = 86_400_000;

export function stepBody(c: Pick<Camp, "template" | "step2_body" | "step3_body">, step: number): string {
  return step === 0 ? c.template : step === 1 ? c.step2_body : step === 2 ? c.step3_body : "";
}

export function renderStep(c: Pick<Camp, "subject" | "template" | "step2_body" | "step3_body">, step: number, domains: string[], vars: { name: string; project: string }) {
  const fill = (s: string) => fillGroupTemplate(s, domains).replaceAll("{name}", vars.name).replaceAll("{project}", vars.project);
  const subj = fill(c.subject || "{domain}");
  return { subject: step === 0 ? subj : `Re: ${subj}`, body: fill(stepBody(c, step)) };
}

export async function runSequences(db: Db, acc: MailAccount): Promise<{ sent: number; closed: number; error?: string }> {
  const { data: cd } = await db
    .from("campaigns")
    .select("id, project_id, name, subject, template, step2_days, step2_body, step3_days, step3_body, daily_limit")
    .eq("team_id", acc.team_id)
    .eq("sender", acc.user_id)
    .eq("status", "active");
  const camps = new Map(((cd ?? []) as Camp[]).map((c) => [c.id, c]));
  if (!camps.size) return { sent: 0, closed: 0 };

  const now = new Date();
  const { data: dd } = await db
    .from("project_donors")
    .select("id, project_id, domain, med_base, stage, core_status, indicator, comm_status, seq_campaign_id, seq_step")
    .eq("team_id", acc.team_id)
    .eq("seq_status", "running")
    .lte("seq_next_at", now.toISOString())
    .in("seq_campaign_id", [...camps.keys()])
    .limit(300);
  const deals = (dd ?? []) as Deal[];
  if (!deals.length) return { sent: 0, closed: 0 };

  // Лимит: сколько писем этот ящик уже отправил сегодня
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await db
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("team_id", acc.team_id)
    .eq("created_by", acc.user_id)
    .eq("channel", "email")
    .eq("direction", "out")
    .gte("created_at", dayStart.toISOString());
  let quota = Math.min(...[...camps.values()].map((c) => c.daily_limit)) - (used ?? 0);

  const handles = [...new Set(deals.map((d) => d.med_base.trim()).filter(Boolean))];
  const [{ data: cc }, { data: pj }] = await Promise.all([
    handles.length ? db.from("contacts").select("handle, email, name, do_not_contact").eq("team_id", acc.team_id).in("handle", handles) : { data: [] },
    db.from("projects").select("id, name").eq("team_id", acc.team_id),
  ]);
  const contact = new Map(((cc ?? []) as { handle: string; email: string; name: string; do_not_contact: boolean }[]).map((c) => [c.handle, c]));
  const pName = new Map(((pj ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const set = (ids: string[], patch: Record<string, unknown>) => (ids.length ? db.from("project_donors").update(patch).eq("team_id", acc.team_id).in("id", ids) : null);

  // 1) Кого остановить или закрыть без письма
  const stopReplied: string[] = [];
  const stopOther: string[] = [];
  const optout: string[] = [];
  const noEmail: string[] = [];
  const noReply: string[] = [];
  const groups = new Map<string, { camp: Camp; handle: string; step: number; to: string; deals: Deal[] }>();
  for (const d of deals) {
    const c = camps.get(d.seq_campaign_id)!;
    const st = stageOf(d);
    if (st === "replied" || st === "negotiating") { stopReplied.push(d.id); continue; }
    if (st !== "find" && st !== "contacted") { stopOther.push(d.id); continue; }
    const h = d.med_base.trim();
    const ct = contact.get(h);
    if (ct?.do_not_contact) { optout.push(d.id); continue; }
    // После последнего напоминания снова тишина → «Немає відповіді»
    if (d.seq_step >= 3 || (d.seq_step >= 1 && !stepBody(c, d.seq_step).trim())) { noReply.push(d.id); continue; }
    const to = emailOf(h, ct?.email);
    if (!to) { noEmail.push(d.id); continue; }
    const key = `${c.id}|${h}|${d.seq_step}`;
    if (!groups.has(key)) groups.set(key, { camp: c, handle: h, step: d.seq_step, to, deals: [] });
    groups.get(key)!.deals.push(d);
  }
  await Promise.all([
    set(stopReplied, { seq_status: "replied", seq_next_at: null }),
    set(stopOther, { seq_status: "stopped", seq_next_at: null }),
    set(optout, { seq_status: "optout", seq_next_at: null }),
    set(noEmail, { seq_status: "stopped", seq_next_at: null }),
    set(noReply, { seq_status: "done", seq_next_at: null, stage: "lost", reject_reason: "noreply" }),
  ]);

  // 2) Письма — сколько позволяет лимит
  const batch = [...groups.values()].slice(0, Math.max(0, quota));
  if (!batch.length) return { sent: 0, closed: noReply.length };
  const mails = batch.map((g) => ({
    g,
    ...renderStep(g.camp, g.step, g.deals.map((d) => d.domain), { name: contact.get(g.handle)?.name ?? "", project: pName.get(g.camp.project_id) ?? "" }),
  }));
  let res: { messageId: string; error: string }[];
  try {
    res = await sendMany(credsOf(acc), mails.map((m) => ({ to: m.g.to, subject: m.subject.slice(0, 300), text: m.body.slice(0, 20000) })));
  } catch (e) {
    return { sent: 0, closed: noReply.length, error: e instanceof Error ? e.message : String(e) };
  }
  let sent = 0;
  for (let i = 0; i < mails.length; i++) {
    const { g, subject, body } = mails[i];
    const ids = g.deals.map((d) => d.id);
    if (res[i]?.error) {
      await set(ids, { seq_status: "bounced", seq_next_at: null });
      continue;
    }
    sent++;
    quota--;
    await db.from("activities").insert({
      team_id: acc.team_id,
      project_id: g.deals[0].project_id,
      donor_id: ids.length === 1 ? ids[0] : null,
      donor_ids: ids,
      handle: g.handle,
      channel: "email",
      direction: "out",
      subject: subject.slice(0, 500),
      body: `${body}`.slice(0, 4000),
      message_id: res[i]?.messageId ?? "",
      is_read: true,
      created_by: acc.user_id,
    });
    const nextDays = g.step === 0 ? g.camp.step2_days : g.camp.step3_days;
    await set(ids, { seq_step: g.step + 1, seq_next_at: new Date(now.getTime() + nextDays * DAY).toISOString() });
    // Сделки, которым написали впервые, — «Написали»
    const fresh = g.deals.filter((d) => d.indicator !== "replied");
    if (fresh.length)
      await set(fresh.map((d) => d.id), { indicator: "waiting", indicator_at: now.toISOString(), in_comm: true, comm_status: "Contacted" });
  }
  return { sent, closed: noReply.length };
}
