// Работа с ящиком: проверка входа, отправка (SMTP) и чтение входящих (IMAP). Только сервер.
// imapflow — чтение писем, mailparser — разбор текста письма, nodemailer — отправка.
// @ts-ignore — у imapflow могут отсутствовать типы
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { decrypt } from "@/lib/mail/crypto";

export type MailAccount = {
  user_id: string;
  team_id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  secret: string;
  last_uid: number;
};

type Creds = { email: string; password: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number };

function imap(c: Creds) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (ImapFlow as any)({
    host: c.imap_host,
    port: c.imap_port,
    secure: c.imap_port === 993,
    auth: { user: c.email, pass: c.password },
    logger: false,
    socketTimeout: 20_000,
  });
}

function smtp(c: Creds) {
  return nodemailer.createTransport({
    host: c.smtp_host,
    port: c.smtp_port,
    secure: c.smtp_port === 465,
    auth: { user: c.email, pass: c.password },
  });
}

export function credsOf(a: MailAccount): Creds {
  return { email: a.email, password: decrypt(a.secret), imap_host: a.imap_host, imap_port: a.imap_port, smtp_host: a.smtp_host, smtp_port: a.smtp_port };
}

// Проверка, что пароль подходит и для чтения, и для отправки
export async function verify(c: Creds): Promise<void> {
  const cl = imap(c);
  await cl.connect();
  await cl.logout();
  await smtp(c).verify();
}

export async function send(c: Creds, to: string, subject: string, text: string, inReplyTo = ""): Promise<string> {
  const reply = inReplyTo && !inReplyTo.startsWith("uid-") ? { inReplyTo, references: inReplyTo } : {};
  const info = await smtp(c).sendMail({ from: c.email, to, subject, text, ...reply });
  return String(info.messageId ?? "");
}

// Несколько писем через одно соединение (массовая отправка). Ошибка одного письма не останавливает остальные.
export async function sendMany(c: Creds, items: { to: string; subject: string; text: string }[]): Promise<{ messageId: string; error: string }[]> {
  const tr = smtp(c);
  const out: { messageId: string; error: string }[] = [];
  for (const it of items) {
    try {
      const info = await tr.sendMail({ from: c.email, to: it.to, subject: it.subject, text: it.text });
      out.push({ messageId: String(info.messageId ?? ""), error: "" });
    } catch (e) {
      out.push({ messageId: "", error: e instanceof Error ? e.message : String(e) });
    }
  }
  tr.close();
  return out;
}

export type Incoming = { uid: number; from: string; subject: string; text: string; messageId: string; date: string };

// Новые письма во «Входящих» после lastUid (при первом запуске — за 14 дней), не больше limit
export async function fetchNew(c: Creds, lastUid: number, limit = 60): Promise<{ items: Incoming[]; maxUid: number }> {
  const cl = imap(c);
  await cl.connect();
  const items: Incoming[] = [];
  let maxUid = lastUid;
  const lock = await cl.getMailboxLock("INBOX");
  try {
    const query = lastUid > 0 ? { uid: `${lastUid + 1}:*` } : { since: new Date(Date.now() - 14 * 86_400_000) };
    const uids: number[] = ((await cl.search(query, { uid: true })) || []).filter((u: number) => u > lastUid);
    const pick = uids.sort((a, b) => a - b).slice(-limit);
    for (const uid of uids) maxUid = Math.max(maxUid, uid);
    for await (const m of cl.fetch(pick.join(",") || "0", { uid: true, envelope: true, source: true, size: true }, { uid: true })) {
      const from = (m.envelope?.from?.[0]?.address ?? "").toLowerCase();
      let text = "";
      if (m.source && (m.size ?? 0) < 1_500_000) {
        const parsed = await simpleParser(m.source);
        text = (parsed.text ?? "").trim();
      }
      items.push({
        uid: m.uid,
        from,
        subject: String(m.envelope?.subject ?? "").slice(0, 500),
        text: text.slice(0, 4000),
        messageId: String(m.envelope?.messageId ?? `uid-${m.uid}`),
        date: (m.envelope?.date ? new Date(m.envelope.date) : new Date()).toISOString(),
      });
    }
  } finally {
    lock.release();
    await cl.logout().catch(() => undefined);
  }
  return { items, maxUid };
}
