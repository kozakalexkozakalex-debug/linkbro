"use client";

import { useMemo, useState } from "react";
import { updateIntermediariesBatch } from "../projects/actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { fmtDate } from "@/lib/global";

export type IntermediaryRow = { domain: string; intermediary: string; price: string; updated_at: string };
type Row = IntermediaryRow & { id: string };

export default function IntermediariesTable({ rows }: { rows: IntermediaryRow[] }) {
  const [q, setQ] = useState("");
  const shown: Row[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => !s || r.domain.includes(s) || r.intermediary.toLowerCase().includes(s))
      .map((r) => ({ ...r, id: r.domain }));
  }, [rows, q]);

  const columns: SheetCol<Row>[] = useMemo(
    () => [
      { key: "domain", header: "Донор", kind: "readonly", width: 200, render: (r) => <span className="font-mono font-semibold">{r.domain}</span> },
      { key: "intermediary", header: "Посередник", kind: "text", width: 260, placeholder: "email або контакт" },
      { key: "price", header: "Ціна", kind: "text", width: 110 },
      { key: "updated", header: "Оновлено", kind: "readonly", width: 100, mono: true, get: (r) => fmtDate(r.updated_at) },
    ],
    [],
  );

  if (rows.length === 0) return <div className="card text-center text-mute">База поки порожня.</div>;

  return (
    <>
      <div className="field max-w-xs">
        <label htmlFor="mb-search" className="lbl">Пошук</label>
        <input id="mb-search" className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="домен або посередник" />
      </div>
      <Sheet rows={shown} columns={columns} onSave={(changes) => updateIntermediariesBatch(changes)} refreshAfterSave={false} />
    </>
  );
}
