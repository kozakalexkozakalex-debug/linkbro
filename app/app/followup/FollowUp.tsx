"use client";

// Списки «кому написати» + массовая отправка: выделили сделки → выбрали шаблон → одно письмо каждой.
// Переменные {domain} {price} {anchor} {page} {deadline} подставляются для каждой сделки свои.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { fillTemplate, type FillData } from "@/lib/outreach";
import { sendBulk, type BulkResult } from "@/app/app/outreach/actions";

export type FuRow = {
  id: string;
  domain: string;
  project: string;
  handle: string;
  email: string;
  stage: string;
  since: string | null; // дата плана или когда написали
  note: string;
  fill: FillData;
};
type ListKey = "plan" | "wait" | "first";
const PER_PAGE = 100;
const CHUNK = 10;

export default function FollowUp(props: {
  list: ListKey;
  days: number;
  dayOptions: number[];
  lists: Record<ListKey, FuRow[]>;
  templates: { id: string; name: string; body: string }[];
  mail: string | null;
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const rows = props.lists[props.list];
  const [shown, setShown] = useState(PER_PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(props.list === "first" ? "{domain}" : "Re: {domain}");
  const [body, setBody] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ domain: string; error: string }[]>([]);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const withEmail = rows.filter((r) => r.email);

  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  };
  const allOn = withEmail.length > 0 && withEmail.every((r) => sel.has(r.id));
  const first = rows.find((r) => sel.has(r.id));

  function send() {
    const chosen = [...sel].map((id) => byId.get(id)).filter((r): r is FuRow => !!r && !!r.email);
    if (!chosen.length || !body.trim()) return;
    setFailed([]);
    start(async () => {
      let sent = 0;
      const bad: { domain: string; error: string }[] = [];
      for (let i = 0; i < chosen.length; i += CHUNK) {
        const part = chosen.slice(i, i + CHUNK);
        setProgress(t("out.sending", { n: i, total: chosen.length }));
        const r: BulkResult = await sendBulk(part.map((x) => ({ donorId: x.id, subject: fillTemplate(subject, x.fill), body: fillTemplate(body, x.fill) })));
        if (r.error) {
          bad.push({ domain: "—", error: r.error });
          break;
        }
        sent += r.sent;
        for (const f of r.failed) bad.push({ domain: byId.get(f.donorId)?.domain ?? f.donorId, error: f.error });
      }
      setProgress(t("out.bulkDone", { n: sent }));
      setFailed(bad);
      setSel(new Set());
      router.refresh(); // сделки перешли в «Написали»
    });
  }

  const tab = (k: ListKey, label: string) => (
    <Link href={`/app/followup?l=${k}&d=${props.days}`} className={props.list === k ? "seg-on" : ""}>
      {label} · {props.lists[k].length}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg max-w-full overflow-x-auto">
          {tab("plan", t("out.lPlan"))}
          {tab("wait", t("out.lWait"))}
          {tab("first", t("out.lFirst"))}
        </div>
        {props.list === "wait" && (
          <div className="seg">
            {props.dayOptions.map((d) => (
              <Link key={d} href={`/app/followup?l=wait&d=${d}`} className={props.days === d ? "seg-on" : ""}>
                {t("out.days", { n: d })}
              </Link>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-mute">{t(props.list === "plan" ? "out.hPlan" : props.list === "wait" ? "out.hWait" : "out.hFirst", { n: props.days })}</p>

      {rows.length === 0 ? (
        <p className="card text-center text-mute">{t("out.empty")}</p>
      ) : (
        <>
          {/* ---------- Лист для выделенных ---------- */}
          <section className="card flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="lbl mr-auto">{t("out.bulkTitle", { n: sel.size })}</p>
              {props.templates.length > 0 && (
                <select
                  aria-label={t("nav.templates")}
                  className="inp w-auto"
                  value=""
                  onChange={(e) => {
                    const tpl = props.templates.find((x) => x.id === e.target.value);
                    if (tpl) setBody(tpl.body);
                  }}
                >
                  <option value="">{t("out.useTemplate")}</option>
                  {props.templates.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              )}
            </div>
            {!props.mail ? (
              <p className="text-sm text-mute">
                {t("mail.notConnected")} <Link href="/app/mail" className="underline">{t("mail.connect")}</Link>
              </p>
            ) : (
              <>
                <input aria-label={t("out.subject")} className="inp" placeholder={t("out.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
                <textarea aria-label={t("out.text")} className="inp min-h-28 text-sm" placeholder={t("out.bulkPh")} value={body} onChange={(e) => setBody(e.target.value)} />
                {first && body && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-mute">{t("out.preview", { d: first.domain })}</summary>
                    <p className="mt-1 font-medium">{fillTemplate(subject, first.fill)}</p>
                    <p className="whitespace-pre-wrap text-mute">{fillTemplate(body, first.fill)}</p>
                  </details>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-pri" disabled={pending || !sel.size || !body.trim()} onClick={send}>
                    {pending ? "…" : t("out.bulkSend", { n: sel.size })}
                  </button>
                  {progress && <span className="text-sm text-mute">{progress}</span>}
                </div>
                {failed.length > 0 && (
                  <ul className="text-sm text-bad">
                    {failed.map((f, i) => (
                      <li key={i}>
                        <span className="font-mono">{f.domain}</span>: {f.error}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          {/* ---------- Список сделок ---------- */}
          <section className="card p-0">
            <label className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm">
              <input
                type="checkbox"
                checked={allOn}
                disabled={!withEmail.length}
                onChange={() => setSel(allOn ? new Set() : new Set(withEmail.map((r) => r.id)))}
              />
              <span>{t("out.selectAll", { n: withEmail.length })}</span>
              {withEmail.length < rows.length && <span className="ml-auto text-xs text-mute">{t("out.noEmailN", { n: rows.length - withEmail.length })}</span>}
            </label>
            <ul className="divide-y divide-line">
              {rows.slice(0, shown).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                  <input type="checkbox" aria-label={r.domain} checked={sel.has(r.id)} disabled={!r.email} onChange={() => toggle(r.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm">{r.domain}</span>
                      <span className="pill max-sm:hidden">{r.stage}</span>
                      {r.since && (
                        <span className="ml-auto shrink-0 font-mono text-xs text-mute" suppressHydrationWarning>
                          {new Date(r.since).toLocaleDateString(intl, { day: "2-digit", month: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-mute">
                      {r.handle ? (
                        <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(r.handle)}`} className="underline">{r.handle}</Link>
                      ) : (
                        "—"
                      )}
                      {r.project && ` · ${r.project}`}
                      {r.note && ` · ${r.note}`}
                      {!r.email && <span className="text-accent"> · {t("out.noEmail")}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {rows.length > shown && (
              <div className="flex justify-center p-3">
                <button type="button" className="btn" onClick={() => setShown(shown + PER_PAGE)}>
                  {t("sheet.more", { shown, total: rows.length })}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
