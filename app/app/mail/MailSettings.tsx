"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectMail, disconnectMail, syncMyMail, type MailInfo } from "./actions";
import { MAIL_PRESETS } from "@/lib/mail/presets";
import { fmtDateTime } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";

export default function MailSettings({ info }: { info: MailInfo }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [f, setF] = useState({ email: "", password: "", preset: "gmail", imapHost: "", smtpHost: "", smtpPort: "465" });
  const run = (fn: () => Promise<{ ok?: boolean; error?: string; added?: number; skipped?: boolean }>, okText: (r: { added?: number }) => string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { text: r.error, bad: true } : { text: okText(r) });
      router.refresh();
    });

  if (info) {
    return (
      <section className="card flex flex-col gap-3">
        <p className="lbl">{t("mail.connected")}</p>
        <p className="text-lg font-semibold">📧 {info.email}</p>
        <p className="text-sm text-mute" suppressHydrationWarning>
          {info.last_sync_at ? t("mail.lastSync", { date: fmtDateTime(info.last_sync_at, intl) }) : t("mail.neverSynced")}
        </p>
        {info.last_error && <p className="note note-bad">{t("mail.syncError", { x: info.last_error })}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-pri" disabled={pending} onClick={() => run(() => syncMyMail(true), (r) => t("mail.synced", { n: r.added ?? 0 }))}>
            {pending ? t("mail.syncing") : t("mail.syncNow")}
          </button>
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => disconnectMail(), () => t("mail.disconnected"))}>{t("mail.disconnect")}</button>
        </div>
        {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`}>{msg.text}</p>}
        <p className="text-sm text-mute">{t("mail.howItWorks")}</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card flex flex-col gap-3">
        <p className="lbl">{t("mail.connect")}</p>
        <div className="field">
          <label htmlFor="m-preset" className="lbl">{t("mail.provider")}</label>
          <select id="m-preset" className="inp" value={f.preset} onChange={(e) => setF({ ...f, preset: e.target.value })}>
            {Object.entries(MAIL_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="custom">{t("mail.other")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="m-email" className="lbl">Email</label>
          <input id="m-email" className="inp" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="m-pass" className="lbl">{t("mail.appPassword")}</label>
          <input id="m-pass" className="inp font-mono" type="password" autoComplete="off" placeholder="xxxx xxxx xxxx xxxx" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <span className="text-xs text-mute">{t("mail.appPasswordHint")}</span>
        </div>
        {f.preset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="IMAP" className="inp" placeholder="imap.example.com" value={f.imapHost} onChange={(e) => setF({ ...f, imapHost: e.target.value })} />
            <input aria-label="SMTP" className="inp" placeholder="smtp.example.com" value={f.smtpHost} onChange={(e) => setF({ ...f, smtpHost: e.target.value })} />
          </div>
        )}
        <button type="button" className="btn btn-pri" disabled={pending || !f.email || !f.password} onClick={() => run(() => connectMail(f), () => t("mail.connectedOk"))}>
          {pending ? t("mail.checking") : t("mail.connectBtn")}
        </button>
        {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`}>{msg.text}</p>}
      </section>
      <section className="card flex flex-col gap-2 text-sm">
        <p className="lbl">{t("mail.gmailSteps")}</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>{t("mail.step1")}</li>
          <li>{t("mail.step2")}</li>
          <li>{t("mail.step3")}</li>
          <li>{t("mail.step4")}</li>
        </ol>
        <a className="mt-1 underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords ↗</a>
        <p className="mt-2 text-mute">{t("mail.safety")}</p>
      </section>
    </div>
  );
}
