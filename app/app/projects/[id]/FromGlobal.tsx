"use client";

import { useMemo } from "react";
import Link from "next/link";
import { updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { BulkButton } from "@/components/BulkTools";
import { metricCols } from "@/components/MetricCols";
import { fmtDate } from "@/lib/global";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

const FG_OPTS = [
  { value: "new", label: "Пул" },
  { value: "check", label: "Check" },
  { value: "ok", label: "OK" },
  { value: "core", label: "→ Outreach" },
  { value: "out", label: "Out" },
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
  const { t, intl } = useI18n();
  const columns: SheetCol<ProjectDonor>[] = useMemo(
    () => [
      { key: "domain", header: "Domain", kind: "readonly", width: 170, render: (d) => <span className="font-mono font-semibold whitespace-nowrap">{d.domain}</span> },
      { key: "added", header: "Date Added", kind: "readonly", width: 90, mono: true, get: (d) => fmtDate(d.added_at, intl) },
      ...metricCols(),
      {
        key: "fg_status",
        header: "GEO / Topics",
        kind: "select",
        width: 120,
        options: FG_OPTS,
        tone: (v) => (v === "core" || v === "ok" ? "ok" : v === "out" ? "bad" : v === "check" ? "warn" : ""),
      },
    ],
    [intl],
  );

  const setAll = (ids: string[], value: string) => updateDonorsBatch(projectId, ids.map((id) => ({ id, field: "fg_status", value })));

  return (
    <>
      <p className="text-sm text-mute">
        {t("fg.lead")} {t("fg.stops", { tools: stopTools, global: stopGlobal })} ·{" "}
        <Link href={`/app/projects/${projectId}?tab=profile`} className="underline">{t("fg.configure")}</Link>
      </p>
      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkButton label="→ Outreach" onApply={() => setAll(ids, "core")} />
            <BulkButton label="→ OK" onApply={() => setAll(ids, "ok")} />
            <BulkButton label="→ Out" onApply={() => setAll(ids, "out")} />
            <BulkButton label="↺ NEW" onApply={() => setAll(ids, "new")} />
          </>
        )}
        empty={
          <div className="card text-center text-mute">
            {t("fg.empty")}{" "}
            <Link href="/app/global?status=fit" className="underline">{t("nav.global")}</Link>.
          </div>
        }
      />
    </>
  );
}
