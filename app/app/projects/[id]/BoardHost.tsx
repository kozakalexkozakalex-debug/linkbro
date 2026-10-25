"use client";

// Вкладки-доски проекта (Огляд, Домени, Моніторинг) + карточка сделки по нажатию
import { useMemo, useState } from "react";
import OverviewBoard from "./OverviewBoard";
import MonitorBoard from "./MonitorBoard";
import FromGlobal from "./FromGlobal";
import DonorCard from "./DonorCard";
import { STAGES, STAGE_KEY } from "@/lib/stages";
import type { ProjectDonor } from "@/lib/project";
import { DEFAULT_FILTER, type MetricFilter } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";

export default function BoardHost({
  kind,
  projectId,
  rows,
  stopTools = 0,
  stopGlobal = 0,
  projectGeo = "",
  filter,
}: {
  kind: "overview" | "pool" | "monitor";
  projectId: string;
  rows: ProjectDonor[];
  stopTools?: number;
  stopGlobal?: number;
  projectGeo?: string;
  filter?: MetricFilter;
}) {
  const { t } = useI18n();
  const [card, setCard] = useState<ProjectDonor | null>(null);
  const statusOpts = useMemo(
    () => [...STAGES.map((s) => ({ value: s as string, label: t(STAGE_KEY[s]) })), { value: "lost", label: `✕ ${t(STAGE_KEY.lost)}` }],
    [t],
  );
  return (
    <>
      {kind === "overview" && <OverviewBoard rows={rows} onOpen={setCard} />}
      {kind === "pool" && <FromGlobal projectId={projectId} rows={rows} stopTools={stopTools} stopGlobal={stopGlobal} projectGeo={projectGeo} filter={filter ?? DEFAULT_FILTER} />}
      {kind === "monitor" && (
        <>
          <p className="max-w-3xl text-sm text-mute">{t("mon.lead")}</p>
          <MonitorBoard projectId={projectId} rows={rows} onOpen={setCard} />
        </>
      )}
      {card && <DonorCard projectId={projectId || card.project_id} donor={card} statusOpts={statusOpts} initialTab={kind === "monitor" ? "pub" : "chat"} onClose={() => setCard(null)} />}
    </>
  );
}
