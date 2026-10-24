"use client";

// Вкладки-доски проекта (Огляд, Домени, Моніторинг) + карточка сделки по нажатию
import { useMemo, useState } from "react";
import OverviewBoard from "./OverviewBoard";
import PoolBoard from "./PoolBoard";
import MonitorBoard from "./MonitorBoard";
import FromGlobal from "./FromGlobal";
import DonorCard from "./DonorCard";
import { STAGES, STAGE_KEY } from "@/lib/stages";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

export default function BoardHost({
  kind,
  projectId,
  rows,
  stopTools = 0,
  stopGlobal = 0,
  projectGeo = "",
}: {
  kind: "overview" | "pool" | "monitor";
  projectId: string;
  rows: ProjectDonor[];
  stopTools?: number;
  stopGlobal?: number;
  projectGeo?: string;
}) {
  const { t } = useI18n();
  const [card, setCard] = useState<ProjectDonor | null>(null);
  const [view, setView] = useState<"board" | "table">("board");
  const statusOpts = useMemo(
    () => [...STAGES.map((s) => ({ value: s as string, label: t(STAGE_KEY[s]) })), { value: "lost", label: `✕ ${t(STAGE_KEY.lost)}` }],
    [t],
  );
  return (
    <>
      {kind === "overview" && <OverviewBoard rows={rows} onOpen={setCard} />}
      {kind === "pool" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-3xl text-sm text-mute">{t("pool.lead")}</p>
            <div className="seg" role="group">
              <button type="button" className={view === "board" ? "seg-on" : ""} onClick={() => setView("board")}>{t("work.kanban")}</button>
              <button type="button" className={view === "table" ? "seg-on" : ""} onClick={() => setView("table")}>{t("work.table")}</button>
            </div>
          </div>
          {view === "board" ? (
            <PoolBoard projectId={projectId} projectGeo={projectGeo} rows={rows} onOpen={setCard} />
          ) : (
            <FromGlobal projectId={projectId} rows={rows} stopTools={stopTools} stopGlobal={stopGlobal} />
          )}
        </>
      )}
      {kind === "monitor" && (
        <>
          <p className="max-w-3xl text-sm text-mute">{t("mon.lead")}</p>
          <MonitorBoard projectId={projectId} rows={rows} onOpen={setCard} />
        </>
      )}
      {card && <DonorCard projectId={projectId || card.project_id} donor={card} statusOpts={statusOpts} onClose={() => setCard(null)} />}
    </>
  );
}
