"use client";

// Загальна доска проєкту: де зараз кожен сайт — у пулі, в Outreach, на статті, опубліковано чи проблема.
import { useMemo } from "react";
import Board from "@/components/Board";
import { OVERVIEW, OVERVIEW_KEY, STAGE_KEY, overviewOf, stageOf } from "@/lib/stages";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

export default function OverviewBoard({ rows, onOpen }: { rows: ProjectDonor[]; onOpen: (d: ProjectDonor) => void }) {
  const { t } = useI18n();
  const cols = useMemo(
    () => [
      ...OVERVIEW.map((o) => ({ key: o as string, label: t(OVERVIEW_KEY[o]), tone: (o === "published" ? "ok" : o === "problem" ? "bad" : "") as "ok" | "bad" | "" })),
      { key: "dropped", label: t(OVERVIEW_KEY.dropped), tone: "bad" as const },
    ],
    [t],
  );
  return (
    <Board
      cols={cols}
      items={rows}
      colOf={(d) => overviewOf(d)}
      canMove={false}
      hidden={["dropped"]}
      hiddenLabel={t("stage.showDroppedShort")}
      monthOf={(d) => {
        const c = overviewOf(d);
        return { months: [d.added_at.slice(0, 7), (d.published_at ?? "").slice(0, 7)], open: c !== "published" && c !== "dropped" };
      }}
      card={(d) => (
        <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
          <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
          <span className="block truncate text-xs text-mute">
            {d.fg_status === "core" ? t(STAGE_KEY[stageOf(d)]) : d.med_base || "—"}
          </span>
        </button>
      )}
    />
  );
}
