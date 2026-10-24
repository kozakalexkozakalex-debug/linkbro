"use client";

// Моніторинг: опубліковані посилання за станом перевірки. Проблемне посилання — назад в Outreach.
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import Board from "@/components/Board";
import LinkCheck from "@/components/LinkCheck";
import { MONITOR, MONITOR_KEY, monitorOf } from "@/lib/stages";
import { daysLeft } from "@/lib/money";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

export default function MonitorBoard({ projectId, rows, onOpen }: { projectId: string; rows: ProjectDonor[]; onOpen: (d: ProjectDonor) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const cols = useMemo(
    () => MONITOR.map((m) => ({ key: m as string, label: t(MONITOR_KEY[m]), tone: (m === "ok" ? "ok" : m === "lost" ? "bad" : m === "warn" ? "warn" : "") as "ok" | "bad" | "warn" | "" })),
    [t],
  );
  const items = rows.filter((d) => d.stage === "published" || !!d.article_url);
  const backToOutreach = (d: ProjectDonor) =>
    start(async () => {
      const today = new Date().toISOString().slice(0, 10);
      await updateDonorsBatch(projectId || d.project_id, [
        { id: d.id, field: "next_action_at", value: today },
        { id: d.id, field: "next_action", value: t("mon.restoreTask") },
      ]);
      router.refresh();
    });
  return (
    <Board
      cols={cols}
      items={items}
      colOf={(d) => monitorOf(d.link_status)}
      canMove={false}
      monthOf={(d) => ({ months: [(d.published_at ?? d.added_at).slice(0, 7)], open: monitorOf(d.link_status) !== "ok" })}
      card={(d) => {
        const left = daysLeft(d.guarantee_until);
        const col = monitorOf(d.link_status);
        return (
          <div className="flex flex-col gap-1.5">
            <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
              <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
              {d.article_url && <span className="block truncate text-xs text-mute">{d.article_url}</span>}
            </button>
            <div className="flex flex-wrap items-center gap-1">
              <LinkCheck id={d.id} projectId={projectId || d.project_id} status={d.link_status} note={d.link_note} checkedAt={d.link_checked_at} hasUrl={!!d.article_url} />
              {left != null && <span className={`pill ${left < 0 ? "" : left <= 7 ? "pill-bad" : "pill-ok"}`} suppressHydrationWarning>🛡 {left < 0 ? t("gp.expired") : t("unit.days", { n: left })}</span>}
            </div>
            {(col === "lost" || col === "warn") && (
              <button type="button" className="btn btn-sm" disabled={pending} onClick={() => backToOutreach(d)}>{t("mon.toOutreach")}</button>
            )}
          </div>
        );
      }}
    />
  );
}
