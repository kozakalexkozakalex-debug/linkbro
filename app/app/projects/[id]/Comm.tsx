"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markContacted, syncIntermediaries, updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { AddStatus, BulkSelect } from "@/components/BulkTools";
import CopyButton from "@/components/CopyButton";
import DupeBadge from "@/components/DupeBadge";
import { COMM_BAD, COMM_STATUSES, INDICATORS, ageLabel, hoursSince, type CustomStatuses, type Member, type ProjectDonor } from "@/lib/project";

export type MedBusy = Record<string, { donorId: string; assignee: string | null; label: string }[]>;

const TEMPLATE_KEY = "linkbro.mailTemplate";
const DEFAULT_TEMPLATE =
  "Hi!\n\nI'm interested in publishing a guest post on {domains}.\nCould you share your current terms and price?\n\nThanks!";

const IND_OPTS = [{ value: "", label: "—" }, ...INDICATORS.map((i) => ({ value: i.value, label: i.label }))];

export default function Comm({
  projectId,
  rows,
  custom,
  members,
  dupes,
  medBusy,
}: {
  projectId: string;
  rows: ProjectDonor[];
  custom: CustomStatuses;
  members: Member[];
  dupes: Record<string, string[]>;
  medBusy: MedBusy;
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

  const commOpts = useMemo(() => [{ value: "", label: "—" }, ...[...COMM_STATUSES, ...custom.comm].map((s) => ({ value: s, label: s }))], [custom]);
  const memberOpts = useMemo(() => [{ value: "", label: "—" }, ...members.map((m) => ({ value: m.id, label: m.name }))], [members]);

  const columns: SheetCol<ProjectDonor>[] = useMemo(
    () => [
      {
        key: "domain",
        header: "Domain",
        kind: "readonly",
        width: 180,
        render: (d) => (
          <span className="font-mono font-semibold whitespace-nowrap">
            {d.domain}
            <DupeBadge items={dupes[d.domain]} />
          </span>
        ),
      },
      {
        key: "med_base",
        header: "Посередник (БАЗА)",
        kind: "readonly",
        width: 190,
        get: (d) => d.med_base,
        render: (d) => (
          <span className="whitespace-nowrap">
            <span className="inline-block max-w-44 truncate align-middle">{d.med_base || <span className="text-mute">—</span>}</span>
            <DupeBadge
              label="посередник у"
              items={(medBusy[d.med_base] ?? []).filter((x) => x.donorId !== d.id && x.assignee !== d.assignee).map((x) => x.label)}
            />
          </span>
        ),
      },
      { key: "med_add", header: "Посередник (ДОДАТИ)", kind: "text", width: 180, placeholder: "email або контакт" },
      { key: "price_base", header: "Ціна (БАЗА)", kind: "readonly", width: 90, get: (d) => d.price_base || "—" },
      { key: "price_add", header: "Ціна (ДОДАТИ)", kind: "text", width: 90 },
      {
        key: "indicator",
        header: "Індикатор",
        kind: "select",
        width: 150,
        options: IND_OPTS,
        get: (d) => d.indicator ?? "",
        render: (d, v) => {
          const val = v("indicator");
          if (!val) return <span className="text-mute">—</span>;
          const label = IND_OPTS.find((o) => o.value === val)?.label ?? val;
          const hrs = val === d.indicator ? hoursSince(d.indicator_at) : 0;
          const tone = val === "replied" ? "pill-ok" : val === "waiting" && hrs != null ? (hrs < 24 ? "" : hrs < 72 ? "pill-warn" : "pill-bad") : "";
          return (
            <span className={`pill ${tone}`} suppressHydrationWarning>
              {label}
              {hrs != null && val !== "replied" ? ` (${ageLabel(hrs)})` : ""}
            </span>
          );
        },
      },
      {
        key: "comm_status",
        header: "Статус (Комунікація)",
        kind: "select",
        width: 140,
        options: commOpts,
        tone: (v) => (v === "Accepted" ? "ok" : COMM_BAD.includes(v) ? "bad" : ""),
      },
      {
        key: "dialog",
        header: "Діалог",
        kind: "text",
        width: 150,
        placeholder: "посилання на лист",
        render: (_d, v) => {
          const url = v("dialog");
          if (!url) return <span className="sh-ph">посилання на лист</span>;
          return /^https?:\/\//.test(url) ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline">відкрити ↗</a>
          ) : (
            <span className="sh-text">{url}</span>
          );
        },
      },
      { key: "assignee", header: "Відповідальний", kind: "select", width: 140, options: memberOpts },
    ],
    [dupes, medBusy, commOpts, memberOpts],
  );

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

  const setAll = (ids: string[], field: string, value: string) =>
    updateDonorsBatch(projectId, ids.map((id) => ({ id, field, value })));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={sync} disabled={busy}>Синхронізація</button>
        <button type="button" className="btn btn-pri" onClick={() => setDraftsOpen(true)} disabled={busy}>
          Сформувати листи{groups.length ? ` (${groups.length})` : ""}
        </button>
        <button type="button" className="btn" disabled title="Версія 2">Snov.io</button>
        <AddStatus kinds={[{ value: "comm", label: "Комунікація" }]} />
      </div>
      <p className="text-sm text-mute">
        «Синхронізація»: порожні поля (БАЗА) підтягуються з бази посередників, а заповнені (ДОДАТИ) записуються в базу. «Accepted»
        переводить донора в Guest Posting.
      </p>

      {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`} role="status">{msg.text}</p>}

      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkSelect label="Індикатор" options={IND_OPTS} onApply={(v) => setAll(ids, "indicator", v)} />
            <BulkSelect label="Статус" options={commOpts} onApply={(v) => setAll(ids, "comm_status", v)} />
            <BulkSelect label="Відповідальний" options={memberOpts} onApply={(v) => setAll(ids, "assignee", v)} />
          </>
        )}
        empty={<div className="card text-center text-mute">Сюди потрапляють донори зі статусом «In communication» у Project Core.</div>}
      />

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
