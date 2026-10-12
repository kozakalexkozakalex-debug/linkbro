"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { runCheck, updateGlobalField } from "./actions";
import { transferToProjects } from "../projects/actions";
import {
  DEFAULT_FILTER,
  METRICS,
  fmtDate,
  fmtDateTime,
  ratioOf,
  type EditableField,
  type GlobalDonor,
  type MetricFilter,
} from "@/lib/global";

const STATUS = {
  new: { label: "NEW", cls: "" },
  fit: { label: "FIT", cls: "pill-ok" },
  drop: { label: "DROP", cls: "pill-bad" },
} as const;

const FILTER_KEY = "linkbro.globalFilter";

function Cell({
  id,
  field,
  value,
  wide,
  onSaved,
}: {
  id: string;
  field: EditableField;
  value: string | number | null;
  wide?: boolean;
  onSaved: (field: EditableField, value: string | number | null) => void;
}) {
  const initial = value == null ? "" : String(value);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (v === initial) return;
    start(async () => {
      const r = await updateGlobalField(id, field, v);
      if (r.ok) {
        setError(null);
        onSaved(field, r.value);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <input
      id={`g-${id}-${field}`}
      aria-label={field}
      title={error ?? undefined}
      inputMode={wide ? "text" : "decimal"}
      className={`cell ${wide ? "cell-wide" : ""} ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export default function GlobalTable({ initialRows }: { initialRows: GlobalDonor[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MetricFilter>(DEFAULT_FILTER);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [checking, startCheck] = useTransition();

  useEffect(() => setRows(initialRows), [initialRows]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (saved) setFilter({ ...DEFAULT_FILTER, ...JSON.parse(saved) });
    } catch {
      /* без сохранённого фильтра */
    }
  }, []);

  function onSaved(id: string, field: EditableField, value: string | number | null) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function check() {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      /* не страшно */
    }
    startCheck(async () => {
      const r = await runCheck(filter);
      setOpen(false);
      if (r.error) setMsg({ text: "Помилка перевірки: " + r.error, bad: true });
      else setMsg({ text: `FIT: ${r.fit} · DROP: ${r.drop} · лишились NEW (не всі метрики): ${r.skipped}` });
      router.refresh();
    });
  }

  function transfer() {
    startCheck(async () => {
      const r = await transferToProjects();
      if (r.error) setMsg({ text: "Помилка передачі: " + r.error, bad: true });
      else if (r.report.length === 0) setMsg({ text: "Спочатку створіть проєкт.", bad: true });
      else
        setMsg({
          text:
            "Передано у проєкти. " +
            r.report.map((p) => `${p.name}: +${p.added} (не пройшли фільтр: ${p.filtered}, у стоп-листі: ${p.stopped})`).join(" · "),
        });
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-pri" onClick={() => setOpen(true)}>CHECK</button>
        <button type="button" className="btn" onClick={transfer} disabled={checking}>
          Передати у проєкти
        </button>
      </div>

      {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`} role="status">{msg.text}</p>}

      {rows.length === 0 ? (
        <div className="card text-center text-mute">
          Тут поки порожньо. <Link href="/app/input" className="underline">Додайте донорів через Інпут</Link>.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Domain", "Date Added", "DR", "Keywords", "Traffic", "GEO", "Topics", "TF", "CF", "TF/CF", "Price", "Status"].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const ratio = ratioOf(d);
                const cell = (field: EditableField, wide?: boolean) => (
                  <Cell
                    key={`${d.id}-${field}-${String(d[field])}`}
                    id={d.id}
                    field={field}
                    value={d[field]}
                    wide={wide}
                    onSaved={(f, v) => onSaved(d.id, f, v)}
                  />
                );
                return (
                  <tr key={d.id}>
                    <td className="font-mono font-semibold whitespace-nowrap">{d.domain}</td>
                    <td>
                      <span className={`date-chip ${d.batch % 2 ? "date-odd" : "date-even"}`} title={`Ітерація ${d.batch}`}>
                        {fmtDateTime(d.added_at)}
                      </span>
                    </td>
                    <td>{cell("dr")}</td>
                    <td>{cell("keywords")}</td>
                    <td>{cell("traffic")}</td>
                    <td>{cell("geo", true)}</td>
                    <td>{cell("topics", true)}</td>
                    <td>{cell("tf")}</td>
                    <td>{cell("cf")}</td>
                    <td className="font-mono">{ratio == null ? "—" : ratio.toFixed(2)}</td>
                    <td>{cell("price", true)}</td>
                    <td>
                      <span
                        className={`pill ${STATUS[d.status].cls}`}
                        title={d.checked_at ? `Перевірено ${fmtDate(d.checked_at)}` : "Ще не перевірявся"}
                      >
                        {STATUS[d.status].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="card flex w-full max-w-md flex-col gap-4" role="dialog" aria-label="Фільтр Global">
            <div>
              <h2 className="font-display text-lg font-medium">Налаштування фільтра Global</h2>
              <p className="mt-1 text-sm text-mute">
                NEW → FIT / DROP. Порожній Max означає «без верхньої межі». Якщо хоч одна метрика не заповнена, донор лишається NEW.
                GEO і Topics у фільтрі не беруть участі.
              </p>
            </div>
            <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
              <span />
              <span className="lbl">Min</span>
              <span className="lbl">Max</span>
              {METRICS.map((m) => (
                <div key={m.key} className="contents">
                  <b className="text-sm">{m.label}</b>
                  {(["min", "max"] as const).map((edge) => (
                    <input
                      key={edge}
                      id={`f-${m.key}-${edge}`}
                      aria-label={`${m.label} ${edge}`}
                      inputMode="decimal"
                      className="inp"
                      value={filter[m.key][edge]}
                      onChange={(e) => setFilter({ ...filter, [m.key]: { ...filter[m.key], [edge]: e.target.value } })}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-pri" onClick={check} disabled={checking}>
                {checking ? "Перевіряю…" : "Запустити"}
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
