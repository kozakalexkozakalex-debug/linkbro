"use client";

// «Написати посереднику»: выделенные сделки группируются по посреднику — одно письмо на посредника
// со списком всех его доменов. В базе письмо хранится один раз и привязано ко всем этим сделкам.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { prepareGroupMail, sendGroupMail, type MailGroup } from "@/app/app/outreach/actions";
import { fillGroupTemplate } from "@/lib/outreach";
import { useI18n } from "@/components/I18nProvider";

const DEFAULT = "Hi!\n\nI'm interested in guest posts on these sites:\n{domains}\n\nCould you share your current prices and terms for each?\n\nThanks!";

type Draft = MailGroup & { to: string; subject: string; body: string; on: boolean };

export default function GroupMail({ donorIds, onClose, initialTemplate }: { donorIds: string[]; onClose: () => void; initialTemplate?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof prepareGroupMail>> | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tpl, setTpl] = useState(initialTemplate?.trim() ? initialTemplate : DEFAULT);
  const [subject, setSubject] = useState("Guest posts: {domain} and more");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    prepareGroupMail(donorIds).then((r) => {
      setData(r);
      setDrafts(r.groups.map((g) => ({ ...g, to: g.email, subject: "", body: "", on: !!g.email })));
    });
  }, [donorIds]);

  const build = (g: Draft) => {
    const domains = g.donors.map((d) => d.domain);
    return {
      subject: fillGroupTemplate(g.subject || subject, domains).replace(" and more", domains.length > 1 ? " and more" : ""),
      body: g.body || fillGroupTemplate(tpl, domains),
    };
  };
  const upd = (h: string, patch: Partial<Draft>) => setDrafts(drafts.map((d) => (d.handle === h ? { ...d, ...patch } : d)));
  const chosen = drafts.filter((d) => d.on);

  function send() {
    setMsg(null);
    start(async () => {
      const r = await sendGroupMail(chosen.map((g) => ({ handle: g.handle, to: g.to, donorIds: g.donors.map((d) => d.id), ...build(g) })));
      if (r.error) return setMsg({ text: r.error, bad: true });
      setMsg({
        text: t("gm.done", { n: r.sent }) + (r.failed.length ? ` · ${r.failed.map((f) => `${f.handle}: ${f.error}`).join("; ")}` : ""),
        bad: r.failed.length > 0,
      });
      router.refresh();
    });
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-auto" role="dialog" aria-label={t("gm.title")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">{t("gm.title")}</h2>
            <p className="text-sm text-mute">{t("gm.hint")}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>
        {!data ? (
          <p className="text-mute">…</p>
        ) : !data.mail ? (
          <p className="text-sm">{t("mail.notConnected")} <Link href="/app/mail" className="underline">{t("mail.connect")}</Link></p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label={t("out.subject")} className="inp min-w-0 flex-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
              {data.templates.length > 0 && (
                <select aria-label={t("nav.templates")} className="inp w-auto" value="" onChange={(e) => { const x = data.templates.find((y) => y.id === e.target.value); if (x) setTpl(x.body); }}>
                  <option value="">{t("out.useTemplate")}</option>
                  {data.templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              )}
            </div>
            <textarea aria-label={t("out.text")} className="inp min-h-28 text-sm" value={tpl} onChange={(e) => setTpl(e.target.value)} />
            <p className="text-xs text-mute">{t("gm.vars")}</p>
            <ul className="flex flex-col gap-2">
              {drafts.map((g) => {
                const b = build(g);
                return (
                  <li key={g.handle} className={`rounded-lg border p-3 ${g.on ? "border-line-strong" : "border-line opacity-70"}`}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={g.on} onChange={(e) => upd(g.handle, { on: e.target.checked })} />
                      <b className="truncate">{g.handle}</b>
                      <span className="ml-auto text-xs text-mute">{t("gm.domains", { n: g.donors.length })}</span>
                    </label>
                    <input aria-label={t("out.to")} className="inp mt-2 py-1 text-sm" placeholder={t("out.to")} value={g.to} onChange={(e) => upd(g.handle, { to: e.target.value, on: !!e.target.value })} />
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-mute">{b.subject}</summary>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-mute">{b.body}</p>
                    </details>
                  </li>
                );
              })}
            </ul>
            {data.noContact.length > 0 && <p className="text-sm text-accent">{t("gm.noContact", { x: data.noContact.join(", ") })}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-pri" disabled={pending || !chosen.length} onClick={send}>
                {pending ? "…" : t("gm.send", { n: chosen.length })}
              </button>
              {msg && <span className={`text-sm ${msg.bad ? "text-bad" : "text-mute"}`}>{msg.text}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
