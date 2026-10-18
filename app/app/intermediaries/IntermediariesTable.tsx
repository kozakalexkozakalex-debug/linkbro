"use client";

import { useMemo, useState } from "react";
import { updateIntermediariesBatch } from "../projects/actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { fmtDate } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";

export type IntermediaryRow = { domain: string; intermediary: string; price: string; updated_at: string };
type Row = IntermediaryRow & { id: string };

export default function IntermediariesTable({ rows }: { rows: IntermediaryRow[] }) {
  const { t, intl } = useI18n();
  const [q, setQ] = useState("");
  const shown: Row[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => !s || r.domain.includes(s) || r.intermediary.toLowerCase().includes(s))
      .map((r) => ({ ...r, id: r.domain }));
  }, [rows, q]);

  const columns: SheetCol<Row>[] = useMemo(
    () => [
      { key: "domain", header: t("med.donor"), kind: "readonly", width: 200, render: (r) => <span className="font-mono font-semibold">{r.domain}</span> },
      { key: "intermediary", header: t("med.intermediary"), kind: "text", width: 260, placeholder: t("med.contactPh") },
      { key: "price", header: t("common.price"), kind: "text", width: 110 },
      { key: "updated", header: t("med.updated"), kind: "readonly", width: 100, mono: true, get: (r) => fmtDate(r.updated_at, intl) },
    ],
    [t, intl],
  );

  if (rows.length === 0) return <div className="card text-center text-mute">{t("med.empty")}</div>;

  return (
    <>
      <div className="field max-w-xs">
        <label htmlFor="mb-search" className="lbl">{t("common.search")}</label>
        <input id="mb-search" className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("med.searchPh")} />
      </div>
      <Sheet rows={shown} columns={columns} onSave={(changes) => updateIntermediariesBatch(changes)} refreshAfterSave={false} />
    </>
  );
}
