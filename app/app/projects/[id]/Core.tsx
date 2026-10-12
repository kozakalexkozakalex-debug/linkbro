"use client";

import { useMemo } from "react";
import { updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { AddStatus, BulkSelect } from "@/components/BulkTools";
import { metricCols } from "@/components/MetricCols";
import DupeBadge from "@/components/DupeBadge";
import { fmtDate } from "@/lib/global";
import { CORE_NEG, CORE_POS, monthYear, type CustomStatuses, type Member, type ProjectDonor } from "@/lib/project";

export default function Core({
  projectId,
  rows,
  custom,
  members,
  dupes,
}: {
  projectId: string;
  rows: ProjectDonor[];
  custom: CustomStatuses;
  members: Member[];
  dupes: Record<string, string[]>;
}) {
  const pos = useMemo(() => [...CORE_POS, ...custom.core_pos], [custom]);
  const neg = useMemo(() => [...CORE_NEG, ...custom.core_neg], [custom]);
  const statusOpts = useMemo(
    () => [
      { value: "new_core", label: "new_core" },
      ...pos.map((s) => ({ value: s, label: `✓ ${s}` })),
      ...neg.map((s) => ({ value: s, label: `✕ ${s}` })),
    ],
    [pos, neg],
  );
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
      { key: "added", header: "Date Added", kind: "readonly", width: 90, mono: true, get: (d) => fmtDate(d.added_at) },
      ...metricCols(),
      {
        key: "core_status",
        header: "Status",
        kind: "select",
        width: 150,
        options: statusOpts,
        tone: (v) => (pos.includes(v) ? "ok" : neg.includes(v) ? "bad" : ""),
        render: undefined,
      },
      { key: "category_page", header: "Category Page", kind: "text", width: 130, placeholder: "/blog/" },
      { key: "assignee", header: "Відповідальний", kind: "select", width: 140, options: memberOpts },
      {
        key: "published",
        header: "Опубліковано",
        kind: "readonly",
        width: 90,
        mono: true,
        get: (d) => (d.core_status === "Published" && d.published_at ? monthYear(d.published_at) : ""),
      },
    ],
    [dupes, statusOpts, memberOpts, pos, neg],
  );

  const setAll = (ids: string[], field: string, value: string) =>
    updateDonorsBatch(projectId, ids.map((id) => ({ id, field, value })));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">
          «In communication» відкриває модуль Communication, «Price_ok» і далі відкривають Guest Posting.
        </p>
        <AddStatus
          kinds={[
            { value: "core_pos", label: "Схвальний" },
            { value: "core_neg", label: "Несхвальний" },
          ]}
        />
      </div>
      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkSelect label="Статус" options={statusOpts} onApply={(v) => setAll(ids, "core_status", v)} />
            <BulkSelect label="Відповідальний" options={memberOpts} onApply={(v) => setAll(ids, "assignee", v)} />
          </>
        )}
        empty={<div className="card text-center text-mute">Сюди переходять донори, яким у From Global поставили «Core».</div>}
      />
    </>
  );
}
