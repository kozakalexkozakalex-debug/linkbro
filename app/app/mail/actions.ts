"use server";

// Почта пользователя: подключить ящик, синхронизировать, отправить письмо из сделки
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { encrypt } from "@/lib/mail/crypto";
import { MAIL_PRESETS, type MailPreset } from "@/lib/mail/presets";
import { credsOf, send, verify, type MailAccount } from "@/lib/mail/client";
import { syncAccount } from "@/lib/mail/sync";

type Ok = { ok: true } | { ok: false; error: string };
export type MailInfo = { email: string; last_sync_at: string | null; last_error: string } | null;

const ACC_COLS = "user_id, team_id, email, imap_host, imap_port, smtp_host, smtp_port, secret, last_uid";

async function myAccount(): Promise<MailAccount | null> {
  const { supabase, user } = await getTeamContext();
  const { data } = await supabase.from("mail_accounts").select(ACC_COLS).eq("user_id", user.id).maybeSingle();
  return (data as MailAccount | null) ?? null;
}

export async function getMailInfo(): Promise<MailInfo> {
  const { supabase, user } = await getTeamContext();
  const { data } = await supabase.from("mail_accounts").select("email, last_sync_at, last_error").eq("user_id", user.id).maybeSingle();
  return (data as MailInfo) ?? null;
}

export async function connectMail(input: { email: string; password: string; preset: string; imapHost?: string; smtpHost?: string; smtpPort?: string }): Promise<Ok> {
  const { supabase, user, team } = await getTeamContext();
  const { t } = await getI18n();
  const email = input.email.trim().toLowerCase();
  const password = input.password.replace(/\s/g, "");
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !password) return { ok: false, error: t("mail.errFields") };
  const p = MAIL_PRESETS[input.preset as MailPreset];
  const creds = p
    ? { email, password, imap_host: p.imap, imap_port: p.imapPort, smtp_host: p.smtp, smtp_port: p.smtpPort }
    : {
        email,
        password,
        imap_host: (input.imapHost ?? "").trim(),
        imap_port: 993,
        smtp_host: (input.smtpHost ?? "").trim(),
        smtp_port: Number(input.smtpPort) || 465,
      };
  if (!creds.imap_host || !creds.smtp_host) return { ok: false, error: t("mail.errFields") };
  try {
    await verify(creds);
  } catch (e) {
    return { ok: false, error: t("mail.errLogin", { x: e instanceof Error ? e.message : String(e) }) };
  }
  let secret = "";
  try {
    secret = encrypt(password);
  } catch (e) {
    return { ok: false, error: t("mail.errLogin", { x: e instanceof Error ? e.message : String(e) }) };
  }
  const { error } = await supabase.from("mail_accounts").upsert(
    {
      user_id: user.id,
      team_id: team.id,
      email,
      imap_host: creds.imap_host,
      imap_port: creds.imap_port,
      smtp_host: creds.smtp_host,
      smtp_port: creds.smtp_port,
      secret,
      last_uid: 0,
      last_error: "",
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/mail");
  return { ok: true };
}

export async function disconnectMail(): Promise<Ok> {
  const { supabase, user } = await getTeamContext();
  const { error } = await supabase.from("mail_accounts").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/mail");
  return { ok: true };
}

// Проверить новые письма. Без force — не чаще раза в 2 минуты (карточка вызывает при открытии).
export async function syncMyMail(force = false): Promise<{ added: number; error?: string; skipped?: boolean }> {
  const { supabase, user } = await getTeamContext();
  const { data } = await supabase.from("mail_accounts").select(ACC_COLS + ", last_sync_at").eq("user_id", user.id).maybeSingle();
  const acc = data as (MailAccount & { last_sync_at: string | null }) | null;
  if (!acc) return { added: 0, skipped: true };
  if (!force && acc.last_sync_at && Date.now() - new Date(acc.last_sync_at).getTime() < 120_000) return { added: 0, skipped: true };
  const r = await syncAccount(supabase, acc);
  if (r.added) {
    revalidatePath("/app/inbox");
    revalidatePath("/app/today");
  }
  return r;
}

// Отправить письмо посреднику из карточки сделки
export async function sendDealEmail(input: { projectId: string; donorId: string; to: string; subject: string; body: string }): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const acc = await myAccount();
  if (!acc) return { ok: false, error: t("mail.notConnected") };
  const to = input.to.trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(to)) return { ok: false, error: t("mail.errTo") };
  const { data: d } = await supabase.from("project_donors").select("id, med_base, indicator, comm_status, core_status").eq("id", input.donorId).eq("team_id", team.id).maybeSingle();
  const donor = d as { id: string; med_base: string; indicator: string | null; comm_status: string; core_status: string } | null;
  if (!donor) return { ok: false, error: t("err.donorNotFound") };
  let messageId = "";
  try {
    messageId = await send(credsOf(acc), to, input.subject.slice(0, 300), input.body.slice(0, 20000));
  } catch (e) {
    return { ok: false, error: t("mail.errSend", { x: e instanceof Error ? e.message : String(e) }) };
  }
  await supabase.from("activities").insert({
    team_id: team.id,
    project_id: input.projectId,
    donor_id: donor.id,
    handle: donor.med_base,
    channel: "email",
    direction: "out",
    subject: input.subject.slice(0, 500),
    body: input.body.slice(0, 4000),
    message_id: messageId,
  });
  const patch: Record<string, unknown> = {};
  if (donor.indicator !== "replied") {
    patch.indicator = "waiting";
    patch.indicator_at = new Date().toISOString();
    patch.in_comm = true;
    if (!donor.comm_status) patch.comm_status = "Contacted";
    if (["new_core", "OK_Cat", ""].includes(donor.core_status)) patch.core_status = "In communication";
  }
  if (Object.keys(patch).length) await supabase.from("project_donors").update(patch).eq("id", donor.id).eq("team_id", team.id);
  revalidatePath(`/app/projects/${input.projectId}`);
  return { ok: true };
}

export async function markRead(donorId: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  await supabase.from("activities").update({ is_read: true }).eq("team_id", team.id).eq("donor_id", donorId).eq("is_read", false);
  return { ok: true };
}
