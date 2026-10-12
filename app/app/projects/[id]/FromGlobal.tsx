"use client";

import { useMemo } from "react";
import Link from "next/link";
import { updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { BulkButton } from "@/components/BulkTools";
import { metricCols } from "@/components/MetricCols";
import { fmtDate } from "@/lib/global";
import type { ProjectDonor } from "@/lib/project";

const FG_OPTS = [
  { value: "new", label: "NEW" },
  { value: "core", label: "Core" },
  { value: "out", label: "Out Geo/Topics" },
];

export default function FromGlobal({
  projectId,
  rows,
  stopTools,
  stopGlobal,
}: {
  projectId: string;
  rows: ProjectDonor[];
  stopTools: number;
  stopGlobal: number;
}) {
  const columns: SheetCol<ProjectDonor>[] = useMemo(
    () => [
      { key: "domain", header: "Domain", kind: "readonly", width: 170, render: (d) => <span className="font-mono font-semibold whitespace-nowrap">{d.domain}</span> },
      { key: "added", header: "Date Added", kind: "readonly", width: 90, mono: true, get: (d) => fmtDate(d.added_at) },
      ...metricCols(),
      {
        key: "fg_status",
        header: "GEO / Topics",
        kind: "select",
        width: 120,
        options: FG_OPTS,
        tone: (v) => (v === "core" ? "ok" : v === "out" ? "bad" : ""),
      },
    ],
    [],
  );

  const setAll = (ids: string[], value: string) => updateDonorsBatch(projectId, ids.map((id) => ({ id, field: "fg_status", value })));

  return (
    <>
      <p className="text-sm text-mute">
        Сюди потрапляють донори зі статусом FIT, які пройшли фільтр проєкту і яких немає в стоп-листах. GEO і Topics перевіряйте вручну:
        підходить → <b>Core</b>, ні → <b>Out</b>. Можна вибрати кілька рядків галочками. Стоп-лист (інструменти): {stopTools} · Стоп-лист
        (Глобал): {stopGlobal} · <Link href={`/app/projects/${projectId}?tab=profile`} className="underline">налаштувати</Link>
      </p>
      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkButton label="→ Core" onApply={() => setAll(ids, "core")} />
            <BulkButton label="→ Out" onApply={() => setAll(ids, "out")} />
            <BulkButton label="↺ NEW" onApply={() => setAll(ids, "new")} />
          </>
        )}
        empty={
          <div className="card text-center text-mute">
            Донорів ще немає. Натисніть «Передати у проєкти» в{" "}
            <Link href="/app/global?status=fit" className="underline">Глобальній базі</Link>.
          </div>
        }
      />
    </>
  );
}
