"use client";

// Outreach-доска проекта: от поиска контакта до публикации, включая статью.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import Board from "@/components/Board";
import { STAGES, STAGE_KEY, stageOf } from "@/lib/stages";
import { ageLabel, hoursSince, type ProjectDonor } from "@/lib/project";
import { fmtAmount } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";

export default function Kanban({ projectId, rows, customNeg, onOpen }: { projectId: string; rows: ProjectDonor[]; customNeg: string[]; onOpen: (d: ProjectDonor) => void }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const cols = useMemo(
    () => [...STAGES.map((s) => ({ key: s as string, label: t(STAGE_KEY[s]), tone: (s === "published" ? "ok" : "") as "ok" | "" })), { key: "lost", label: t(STAGE_KEY.lost), tone: "bad" as const }],
    [t],
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Board
      cols={cols}
      items={rows}
      colOf={(d) => stageOf(d, customNeg)}
      hidden={["lost"]}
      hiddenLabel={t("stage.showDroppedShort")}
      monthOf={(d) => {
        const st = stageOf(d, customNeg);
        return { months: [d.added_at.slice(0, 7), (d.published_at ?? "").slice(0, 7)], open: st !== "published" && st !== "lost" };
      }}
      onMove={async (d, to) => {
        const r = await updateDonorsBatch(projectId, [{ id: d.id, field: "stage", value: to }]);
        router.refresh();
        return r;
      }}
      card={(d) => {
        const hrs = d.indicator === "waiting" ? hoursSince(d.indicator_at) : null;
        return (
          <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
            <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
            <span className="block truncate text-xs text-mute">{d.med_base || t("stage.noMed")}</span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              {d.gp_price != null && <span className="pill">{fmtAmount(d.gp_price, d.gp_currency || "USD", intl)}</span>}
              {d.next_action_at && (
                <span className={`pill ${d.next_action_at <= today ? "pill-bad" : ""}`} title={d.next_action} suppressHydrationWarning>
                  ⏰ {d.next_action_at.slice(5).split("-").reverse().join(".")}
                </span>
              )}
              {hrs != null && <span className={`pill ${hrs > 72 ? "pill-bad" : ""}`} suppressHydrationWarning>{ageLabel(hrs, t)}</span>}
              {d.article_writer && <span className="pill">✍ {d.article_writer}</span>}
            </span>
          </button>
        );
      }}
    />
  );
}
