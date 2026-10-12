"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setFgStatus } from "../actions";
import { MetricCells, METRIC_HEADERS } from "@/components/MetricCells";
import { fmtDate } from "@/lib/global";
import type { FgStatus, ProjectDonor } from "@/lib/project";

const FG = {
  new: { label: "NEW", cls: "" },
  core: { label: "Core", cls: "pill-ok" },
  out: { label: "Out Geo/Topics", cls: "pill-bad" },
} as const;

function Actions({ d, projectId }: { d: ProjectDonor; projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (s: FgStatus) =>
    start(async () => {
      await setFgStatus(d.id, projectId, s);
      router.refresh();
    });
  return (
    <div className={`flex gap-1 ${pending ? "opacity-60" : ""}`}>
      <button type="button" className="btn btn-sm" disabled={pending || d.fg_status === "core"} onClick={() => go("core")}>Core</button>
      <button type="button" className="btn btn-sm" disabled={pending || d.fg_status === "out" || d.in_comm} onClick={() => go("out")}>Out</button>
      {d.fg_status !== "new" && !d.in_comm && (
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => go("new")} title="Повернути в NEW">↺</button>
      )}
    </div>
  );
}

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
  return (
    <>
      <p className="text-sm text-mute">
        Сюди потрапляють донори зі статусом FIT, які пройшли фільтр проєкту і яких немає в стоп-листах. GEO і Topics перевіряйте вручну:
        підходить → <b>Core</b>, ні → <b>Out</b>. Стоп-лист (інструменти): {stopTools} · Стоп-лист (Глобал): {stopGlobal} ·{" "}
        <Link href={`/app/projects/${projectId}?tab=profile`} className="underline">налаштувати</Link>
      </p>

      {rows.length === 0 ? (
        <div className="card text-center text-mute">
          Донорів ще немає. Натисніть «Передати у проєкти» в{" "}
          <Link href="/app/global?status=fit" className="underline">Глобальній базі</Link>.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Domain", "Date Added", ...METRIC_HEADERS, "Status", "GEO / Topics"].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">{d.domain}</td>
                  <td className="font-mono whitespace-nowrap">{fmtDate(d.added_at)}</td>
                  <MetricCells g={d.global_donors} />
                  <td><span className={`pill ${FG[d.fg_status].cls}`}>{FG[d.fg_status].label}</span></td>
                  <td><Actions d={d} projectId={projectId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
