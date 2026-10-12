"use client";

import { useState, useTransition } from "react";
import { updateIntermediary } from "../projects/actions";
import { fmtDate } from "@/lib/global";

export type IntermediaryRow = { domain: string; intermediary: string; price: string; updated_at: string };

function Cell({ domain, field, value, width }: { domain: string; field: "intermediary" | "price"; value: string; width: number }) {
  const [saved, setSaved] = useState(value);
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <input
      id={`mb-${domain}-${field}`}
      aria-label={field}
      title={error ?? undefined}
      style={{ width }}
      className={`cell cell-box cell-text ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onBlur={() => {
        if (v === saved) return;
        start(async () => {
          const r = await updateIntermediary(domain, field, v);
          if (r.ok) {
            setSaved(v);
            setError(null);
          } else setError(r.error);
        });
      }}
    />
  );
}

export default function IntermediariesTable({ rows }: { rows: IntermediaryRow[] }) {
  const [q, setQ] = useState("");
  const shown = q ? rows.filter((r) => r.domain.includes(q.toLowerCase()) || r.intermediary.toLowerCase().includes(q.toLowerCase())) : rows;

  if (rows.length === 0) return <div className="card text-center text-mute">База поки порожня.</div>;

  return (
    <>
      <div className="field max-w-xs">
        <label htmlFor="mb-search" className="lbl">Пошук</label>
        <input id="mb-search" className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="домен або посередник" />
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>{["Донор", "Посередник", "Ціна", "Оновлено"].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.domain}>
                <td className="font-mono font-semibold whitespace-nowrap">{r.domain}</td>
                <td><Cell domain={r.domain} field="intermediary" value={r.intermediary} width={260} /></td>
                <td><Cell domain={r.domain} field="price" value={r.price} width={110} /></td>
                <td className="font-mono text-mute whitespace-nowrap">{fmtDate(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
