// Фоновая проверка почты всех подключённых ящиков. Вызывается GitHub Actions раз в 15 минут с Bearer CRON_SECRET.
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccount } from "@/lib/mail/sync";
import type { MailAccount } from "@/lib/mail/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const { data } = await db
    .from("mail_accounts")
    .select("user_id, team_id, email, imap_host, imap_port, smtp_host, smtp_port, secret, last_uid")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(20);
  const started = Date.now();
  const result: { email: string; added: number; error?: string }[] = [];
  for (const acc of (data ?? []) as MailAccount[]) {
    if (Date.now() - started > 45_000) break; // укладываемся в лимит времени функции
    const r = await syncAccount(db, acc);
    result.push({ email: acc.email.replace(/^(.{2}).*@/, "$1…@"), ...r });
  }
  return Response.json({ ok: true, accounts: result.length, result });
}
