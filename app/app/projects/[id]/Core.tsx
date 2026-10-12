"use client";

import { addCustomStatus, setCoreStatus } from "../actions";
import { MetricCells, METRIC_HEADERS } from "@/components/MetricCells";
import DonorCell from "@/components/DonorCell";
import StatusSelect from "@/components/StatusSelect";
import AssigneeSelect from "@/components/AssigneeSelect";
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
  const pos = [...CORE_POS, ...custom.core_pos];
  const neg = [...CORE_NEG, ...custom.core_neg];
  const tone = (v: string) => (pos.includes(v) ? "ok" : neg.includes(v) ? "bad" : "") as "ok" | "bad" | "";

  return (
    <>
      <p className="text-sm text-mute">
        Статус веде донора до угоди. «In communication» відкриває модуль Communication, «Price_ok» і далі відкривають Guest Posting.
      </p>

      {rows.length === 0 ? (
        <div className="card text-center text-mute">Сюди переходять донори, яким у From Global натиснули «Core».</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Domain", "Date Added", ...METRIC_HEADERS, "Status", "Category Page", "Відповідальний"].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">
                    {d.domain}
                    <DupeBadge items={dupes[d.domain]} />
                  </td>
                  <td className="font-mono whitespace-nowrap">{fmtDate(d.added_at)}</td>
                  <MetricCells g={d.global_donors} />
                  <td className="whitespace-nowrap">
                    <StatusSelect
                      id={`core-${d.id}`}
                      value={d.core_status}
                      groups={[{ options: ["new_core"] }, { label: "Схвальні", options: pos }, { label: "Несхвальні", options: neg }]}
                      tone={tone}
                      onChange={(v) => setCoreStatus(d.id, projectId, v)}
                      onAddCustom={(kind, name) => addCustomStatus(kind as "core_pos" | "core_neg", name)}
                      addKinds={[
                        { value: "core_pos", label: "Схвальний" },
                        { value: "core_neg", label: "Несхвальний" },
                      ]}
                    />
                    {d.core_status === "Published" && d.published_at && (
                      <span className="ml-1 font-mono text-xs text-mute">({monthYear(d.published_at)})</span>
                    )}
                  </td>
                  <td>
                    <DonorCell id={d.id} field="category_page" value={d.category_page} placeholder="/blog/" />
                  </td>
                  <td>
                    <AssigneeSelect id={d.id} projectId={projectId} value={d.assignee} members={members} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
