"use server";

// Кампании Outreach: создать, изменить, удалить, добавить/убрать сделки
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { CURRENCIES } from "@/lib/money";
import { credsOf, send, type MailAccount } from "@/lib/mail/client";
import { renderStep, runSequences } from "@/lib/mail/sequence";
import { syncAccount } from "@/lib/mail/sync";

const ACC_COLS = "user_id, team_id, email, imap_host, imap_port, smtp_host, smtp_port, secret, last_uid";

type Ok = { ok: true } | { ok: false; error: string };

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(/\s/g, "").replace(",", ".");
    const n = v === "" ? null : Number(v);
    return n != null && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const cur = String(formData.get("currency") ?? "USD");
  const status = String(formData.get("status") ?? "active");
  const ends = String(formData.get("ends_on") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    goal: Math.max(0, Math.round(num("goal") ?? 0)),
    budget: num("budget"),
    currency: (CURRENCIES as readonly string[]).includes(cur) ? cur : "USD",
    template: String(formData.get("template") ?? "").slice(0, 8000),
    status: ["active", "paused", "done"].includes(status) ? status : "active",
    ends_on: /^\d{4}-\d{2}-\d{2}$/.test(ends) ? ends : null,
    subject: String(formData.get("subject") ?? "").slice(0, 300),
    step2_days: Math.min(60, Math.max(1, Math.round(num("step2_days") ?? 3))),
    step2_body: String(formData.get("step2_body") ?? "").slice(0, 8000),
    step3_days: Math.min(60, Math.max(1, Math.round(num("step3_days") ?? 4))),
    step3_body: String(formData.get("step3_body") ?? "").slice(0, 8000),
    daily_limit: Math.min(500, Math.max(1, Math.round(num("daily_limit") ?? 50))),
  };
}

export async function createCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const { projectId } = await getScope();
  const v = parse(formData);
  if (!projectId) redirect(`/app/campaigns?error=${encodeURIComponent(t("cmp.needProject"))}`);
  if (!v.name) redirect(`/app/campaigns?error=${encodeURIComponent(t("cmp.needName"))}`);
  const { data, error } = await supabase.from("campaigns").insert({ ...v, team_id: team.id, project_id: projectId }).select("id").single();
  if (error || !data) redirect(`/app/campaigns?error=${encodeURIComponent(error?.message ?? "error")}`);
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${(data as { id: string }).id}`);
}

export async function updateCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  // Обновляем только поля, которые есть в форме: настройки и цепочка писем — разные формы
  const v = Object.fromEntries(Object.entries(parse(formData)).filter(([k, x]) => formData.has(k) && !(k === "name" && !x)));
  const { error } = await supabase.from("campaigns").update(v).eq("id", id).eq("team_id", team.id);
  revalidatePath(`/app/campaigns/${id}`);
  redirect(`/app/campaigns/${id}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

export async function deleteCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  await supabase.from("campaigns").delete().eq("id", id).eq("team_id", team.id);
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}

// Добавить сделки в кампанию (или убрать — campaignId = null). Только сделки того же проекта.
export async function setDealsCampaign(donorIds: string[], campaignId: string | null): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const ids = donorIds.slice(0, 1000);
  if (!ids.length) return { ok: true };
  if (campaignId) {
    const { data: c } = await supabase.from("campaigns").select("id, project_id").eq("id", campaignId).eq("team_id", team.id).maybeSingle();
    if (!c) return { ok: false, error: t("err.unknownValue") };
    const { error } = await supabase.from("project_donors").update({ campaign_id: campaignId }).eq("team_id", team.id).eq("project_id", (c as { project_id: string }).project_id).in("id", ids);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/campaigns/${campaignId}`);
  } else {
    const { error } = await supabase.from("project_donors").update({ campaign_id: null }).eq("team_id", team.id).in("id", ids);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/app/campaigns");
  return { ok: true };
}

// ---------- Послідовність листів ----------
const WAITING = ["find", "contacted"];

// Запустити цепочку для сделок: письмо 1 уйдёт ближайшим запуском (каждые 15 мин) или по «Надіслати зараз».
export async function enrollDeals(donorIds: string[], campaignId: string): Promise<{ ok: boolean; enrolled: number; skipped: number; error?: string }> {
  const { supabase, team, user } = await getTeamContext();
  const { t } = await getI18n();
  const [{ data: c }, { data: mail }] = await Promise.all([
    supabase.from("campaigns").select("id, project_id, sender, template").eq("id", campaignId).eq("team_id", team.id).maybeSingle(),
    supabase.from("mail_accounts").select("email").eq("user_id", user.id).maybeSingle(),
  ]);
  const camp = c as { id: string; project_id: string; sender: string | null; template: string } | null;
  if (!camp) return { ok: false, enrolled: 0, skipped: 0, error: t("err.unknownValue") };
  if (!mail && !camp.sender) return { ok: false, enrolled: 0, skipped: 0, error: t("mail.notConnected") };
  if (!camp.template.trim()) return { ok: false, enrolled: 0, skipped: 0, error: t("seq.needTemplate") };
  if (!camp.sender) await supabase.from("campaigns").update({ sender: user.id }).eq("id", camp.id).eq("team_id", team.id);
  const { data: dd } = await supabase.from("project_donors").select("id, stage, med_base, seq_status").eq("team_id", team.id).eq("project_id", camp.project_id).in("id", donorIds.slice(0, 1000));
  const ok = ((dd ?? []) as { id: string; stage: string; med_base: string; seq_status: string }[]).filter((d) => WAITING.includes(d.stage) && d.med_base.trim() && d.seq_status !== "running");
  if (ok.length) {
    const { error } = await supabase
      .from("project_donors")
      .update({ campaign_id: camp.id, seq_campaign_id: camp.id, seq_status: "running", seq_step: 0, seq_next_at: new Date().toISOString() })
      .eq("team_id", team.id)
      .in("id", ok.map((d) => d.id));
    if (error) return { ok: false, enrolled: 0, skipped: 0, error: error.message };
  }
  revalidatePath(`/app/campaigns/${camp.id}`);
  return { ok: true, enrolled: ok.length, skipped: donorIds.length - ok.length };
}

export async function stopSequence(donorIds: string[]): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase.from("project_donors").update({ seq_status: "stopped", seq_next_at: null }).eq("team_id", team.id).in("id", donorIds.slice(0, 1000)).eq("seq_status", "running");
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Тестовий лист собі: як побачить посередник перший крок (і напоминания — в тексте ниже)
export async function sendTestMail(campaignId: string, step = 0): Promise<Ok> {
  const { supabase, team, user } = await getTeamContext();
  const { t } = await getI18n();
  const [{ data: c }, { data: a }, { data: deals }] = await Promise.all([
    supabase.from("campaigns").select("subject, template, step2_body, step3_body, project_id").eq("id", campaignId).eq("team_id", team.id).maybeSingle(),
    supabase.from("mail_accounts").select(ACC_COLS).eq("user_id", user.id).maybeSingle(),
    supabase.from("project_donors").select("domain").eq("team_id", team.id).eq("campaign_id", campaignId).limit(3),
  ]);
  if (!c) return { ok: false, error: t("err.unknownValue") };
  if (!a) return { ok: false, error: t("mail.notConnected") };
  const acc = a as MailAccount;
  const domains = ((deals ?? []) as { domain: string }[]).map((d) => d.domain);
  const m = renderStep(c as Parameters<typeof renderStep>[0], step, domains.length ? domains : ["example.com"], { name: "Ivan", project: "" });
  try {
    await send(credsOf(acc), acc.email, `[TEST] ${m.subject}`, m.body);
  } catch (e) {
    return { ok: false, error: t("mail.errSend", { x: e instanceof Error ? e.message : String(e) }) };
  }
  return { ok: true };
}

// «Надіслати зараз» — не ждать фоновый запуск: проверить почту и отправить, что пора
export async function runMySequences(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const { supabase, user } = await getTeamContext();
  const { t } = await getI18n();
  const { data: a } = await supabase.from("mail_accounts").select(ACC_COLS).eq("user_id", user.id).maybeSingle();
  if (!a) return { ok: false, sent: 0, error: t("mail.notConnected") };
  const acc = a as MailAccount;
  await syncAccount(supabase, acc); // сначала ответы — чтобы не написать тому, кто уже ответил
  const r = await runSequences(supabase, acc);
  revalidatePath("/app/campaigns");
  return { ok: !r.error, sent: r.sent, error: r.error };
}
