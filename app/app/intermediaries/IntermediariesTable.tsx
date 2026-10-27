"use client";

import { useMemo, useState } from "react";
import { updateIntermediariesBatch } from "../projects/actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { fmtDate } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";
import Link from "next/link";

export type IntermediaryRow = { domain: string; intermediary: string; price: string; updated_at: string; price_updated_at?: string | null };
type Row = IntermediaryRow & { id: string };

export default function IntermediariesTable({ rows, compact = false }: { rows: IntermediaryRow[]; compact?: boolean }) {
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
      { key: "intermediary", header: t("med.intermediary"), kind: "text", width: 220, placeholder: t("med.contactPh") },
      { key: "domain", header: t("med.donor"), kind: "readonly", width: 190, render: (r) => <span className="font-mono">{r.domain}</span> },
      { key: "price", header: t("common.price"), kind: "text", width: 110 },
      { key: "priceAt", header: t("nexo.priceAt"), kind: "readonly", width: 110, mono: true, get: (r) => (r.price_updated_at ? fmtDate(r.price_updated_at, intl) : "—") },
      {
        key: "profile",
        header: "",
        kind: "readonly",
        width: 80,
        render: (r) => (r.intermediary ? <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(r.intermediary)}`} className="text-xs text-mute underline">{t("medp.open")}</Link> : null),
      },
    ],
    [t, intl],
  );

  if (rows.length === 0) return <div className="card text-center text-mute">{t("med.empty")}</div>;

  return (
    <>
      <input aria-label={t("common.search")} className={`inp ${compact ? "" : "max-w-xs"}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("med.searchPh")} />
      <Sheet rows={shown} columns={columns} onSave={(changes) => updateIntermediariesBatch(changes)} refreshAfterSave={false} />
    </>
  );
}
