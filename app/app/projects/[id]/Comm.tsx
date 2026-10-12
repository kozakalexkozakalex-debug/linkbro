"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomStatus, markContacted, setCommStatus, setIndicator, syncIntermediaries } from "../actions";
import DonorCell from "@/components/DonorCell";
import StatusSelect from "@/components/StatusSelect";
import AssigneeSelect from "@/components/AssigneeSelect";
import CopyButton from "@/components/CopyButton";
import {
  COMM_BAD,
  COMM_STATUSES,
  INDICATORS,
  ageLabel,
  hoursSince,
  type CustomStatuses,
  type Member,
  type ProjectDonor,
} from "@/lib/project";

const TEMPLATE_KEY = "linkbro.mailTemplate";
const DEFAULT_TEMPLATE =
  "Hi!\n\nI'm interested in publishing a guest post on {domains}.\nCould you share your current terms and price?\n\nThanks!";

function IndicatorCell({ d, projectId }: { d: ProjectDonor; projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hrs = hoursSince(d.indicator_at);
  const tone = d.indicator === "replied" ? "pill-ok" : d.indicator === "waiting" && hrs != null ? (hrs < 24 ? "" : hrs < 72 ? "pill-warn" : "pill-bad") : "";

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <select
        id={`ind-${d.id}`}
        aria-label="Індикатор"
        className={`stsel ${pending ? "opacity-60" : ""}`}
        value={d.indicator ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            await setIndicator(d.id, projectId, v);
            router.refresh();
          });
        }}
      >
        <option value="">—</option>
        {INDICATORS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
      </select>
      {d.indicator && hrs != null && (
        <span className={`pill ${tone}`} suppressHydrationWarning>{ageLabel(hrs)}</span>
      )}
    </div>
  );
}

export default function Comm({
  projectId,
  rows,
  custom,
  members,
}: {
  projectId: string;
  rows: ProjectDonor[];
  custom: CustomStatuses;
  members: Member[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, start] = useTransition();
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [template, setTemplate] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TEMPLATE;
    try {
      return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
    } catch {
      return DEFAULT_TEMPLATE;
    }
  });

  const statuses = [...COMM_STATUSES, ...custom.comm];
  const tone = (v: string) => (v === "Accepted" ? "ok" : COMM_BAD.includes(v) ? "bad" : "") as "ok" | "bad" | "";

  // Черновики: донорам с посредником, кому ещё не писали. Один посредник — одно письмо.
  const groups = useMemo(() => {
    const g = new Map<string, ProjectDonor[]>();
    for (const d of rows) {
      if (!d.med_base || d.indicator) continue;
      const list = g.get(d.med_base) ?? [];
      list.push(d);
      g.set(d.med_base, list);
    }
    return [...g.entries()];
  }, [rows]);

  function sync() {
    start(async () => {
      const r = await syncIntermediaries(projectId);
      if (r.error) setMsg({ text: "Помилка синхронізації: " + r.error, bad: true });
      else setMsg({ text: `Синхронізовано. Записано в базу посередників: ${r.wrote}, підтягнуто з бази: ${r.found}.` });
      router.refresh();
    });
  }

  function sent() {
    const ids = groups.flatMap(([, list]) => list.map((d) => d.id));
    start(async () => {
      const r = await markContacted(projectId, ids);
      setDraftsOpen(false);
      if (r.ok) setMsg({ text: `Позначено як відправлені: ${ids.length}. Статус Contacted виставлено автоматично.` });
      else setMsg({ text: r.error, bad: true });
      router.refresh();
    });
  }

  function saveTemplate(v: string) {
    setTemplate(v);
    try {
      localStorage.setItem(TEMPLATE_KEY, v);
    } catch {
      /* не страшно */
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={sync} disabled={busy}>Синхронізація</button>
        <button type="button" className="btn btn-pri" onClick={() => setDraftsOpen(true)} disabled={busy}>
          Сформувати листи{groups.length ? ` (${groups.length})` : ""}
        </button>
        <button type="button" className="btn" disabled title="Версія 2">Snov.io</button>
      </div>
      <p className="text-sm text-mute">
        «Синхронізація»: порожні поля (БАЗА) підтягуються з бази посередників, а заповнені (ДОДАТИ) записуються в базу.
        «Accepted» переводить донора в Guest Posting.
      </p>

      {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`} role="status">{msg.text}</p>}

      {rows.length === 0 ? (
        <div className="card text-center text-mute">Сюди потрапляють донори зі статусом «In communication» у Project Core.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Domain", "Посередник (БАЗА)", "Посередник (ДОДАТИ)", "Ціна (БАЗА)", "Ціна (ДОДАТИ)", "Індикатор", "Статус (Комунікація)", "Діалог", "Відповідальний"].map(
                  (h) => <th key={h}>{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">{d.domain}</td>
                  <td className="max-w-52 truncate" title={d.med_base || undefined}>{d.med_base || <span className="text-mute">—</span>}</td>
                  <td><DonorCell id={d.id} field="med_add" value={d.med_add} width={190} placeholder="email або контакт" /></td>
                  <td className="whitespace-nowrap">{d.price_base || <span className="text-mute">—</span>}</td>
                  <td><DonorCell id={d.id} field="price_add" value={d.price_add} width={90} /></td>
                  <td><IndicatorCell d={d} projectId={projectId} /></td>
                  <td>
                    <StatusSelect
                      id={`comm-${d.id}`}
                      value={d.comm_status}
                      emptyLabel="—"
                      groups={[{ options: statuses }]}
                      tone={tone}
                      onChange={(v) => setCommStatus(d.id, projectId, v)}
                      onAddCustom={(_kind, name) => addCustomStatus("comm", name)}
                      addKinds={[{ value: "comm", label: "Комунікація" }]}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <DonorCell id={d.id} field="dialog" value={d.dialog} width={140} placeholder="посилання на лист" />
                      {/^https?:\/\//.test(d.dialog) && (
                        <a href={d.dialog} target="_blank" rel="noreferrer" className="btn btn-sm">↗</a>
                      )}
                    </div>
                  </td>
                  <td><AssigneeSelect id={d.id} projectId={projectId} value={d.assignee} members={members} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draftsOpen && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setDraftsOpen(false)}>
          <div className="card flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-auto" role="dialog" aria-label="Чернетки листів">
            <div>
              <h2 className="font-display text-lg font-medium">Чернетки листів</h2>
              <p className="mt-1 text-sm text-mute">
                Один лист на посередника. Скопіюйте і надішліть зі своєї пошти, потім натисніть «Позначити як відправлені».
                Автоматичні чернетки в Gmail будуть у версії 2.
              </p>
            </div>

            <div className="field">
              <label htmlFor="tpl" className="lbl">Шаблон ({"{domains}"} підставляється автоматично)</label>
              <textarea id="tpl" className="inp min-h-28 text-sm" value={template} onChange={(e) => saveTemplate(e.target.value)} />
            </div>

            {groups.length === 0 ? (
              <p className="text-mute">
                Немає донорів з посередником, яким ще не писали. Спочатку заповніть «Посередник (ДОДАТИ)» і натисніть «Синхронізація».
              </p>
            ) : (
              groups.map(([to, list]) => {
                const body = template.replaceAll("{domains}", list.map((d) => d.domain).join(", "));
                return (
                  <div key={to} className="rounded-md border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="lbl">Кому</span>
                      <span className="font-mono text-sm">{to}</span>
                      <CopyButton text={to} />
                    </div>
                    <pre className="mb-2 whitespace-pre-wrap rounded bg-bg p-2 text-sm">{body}</pre>
                    <CopyButton text={body} />
                  </div>
                );
              })
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-pri" disabled={busy || groups.length === 0} onClick={sent}>
                Позначити як відправлені
              </button>
              <button type="button" className="btn" onClick={() => setDraftsOpen(false)}>Закрити</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
