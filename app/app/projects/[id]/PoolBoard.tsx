"use client";

// Prefero: домены, которые подходят проекту. Метрики и GEO проверила система, тему подтверждает человек.
// Підходить → В роботі (Outreach) / Не підходить (с причиной). Не подошедшее остаётся в Confero и может подойти другому проекту.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import Board from "@/components/Board";
import { POOL, POOL_KEY, REJECT_REASONS, poolOf } from "@/lib/stages";
import { geoMatches } from "@/lib/global";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export default function PoolBoard({ projectId, projectGeo, rows, onOpen }: { projectId: string; projectGeo: string; rows: ProjectDonor[]; onOpen: (d: ProjectDonor) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const cols = useMemo(
    () => POOL.map((p) => ({ key: p as string, label: t(POOL_KEY[p]), tone: (p === "core" ? "ok" : p === "out" ? "bad" : "") as "ok" | "bad" | "" })),
    [t],
  );
  // Внутри «Підходить» сначала те, где тему уже подтвердили
  const items = useMemo(() => [...rows].sort((a, b) => Number(b.fg_status === "ok") - Number(a.fg_status === "ok")), [rows]);
  const save = async (id: string, changes: { field: string; value: string }[]) => {
    const r = await updateDonorsBatch(projectId, changes.map((c) => ({ id, ...c })));
    router.refresh();
    return r;
  };
  return (
    <Board
      cols={cols}
      items={items}
      colOf={(d) => poolOf(d.fg_status)}
      hidden={["out"]}
      hiddenLabel={t("pool.showOut")}
      monthOf={(d) => ({ months: [d.added_at.slice(0, 7)], open: d.fg_status === "new" || d.fg_status === "ok" })}
      onMove={(d, to) =>
        save(d.id, to === "fit" ? [{ field: "fg_status", value: "ok" }, { field: "reject_reason", value: "" }] : [{ field: "fg_status", value: to }])
      }
      card={(d) => {
        const g = d.global_donors;
        const geo = geoMatches(projectGeo, g?.geo);
        const col = poolOf(d.fg_status);
        return (
          <div className="flex flex-col gap-1.5">
            <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
              <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
              <span className="block font-mono text-xs text-mute">
                DR {g?.dr ?? "—"} · {g?.traffic ?? "—"} · {g?.geo || "—"}
              </span>
              {g?.topics && <span className="block truncate text-xs text-mute">{g.topics}</span>}
            </button>
            {col === "fit" && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="pill text-ok">✓ {t("pool.metrics")}</span>
                <span className={`pill ${geo === false ? "text-bad" : geo ? "text-ok" : "text-mute"}`}>
                  {geo === false ? "✕" : geo ? "✓" : "?"} GEO
                </span>
                {d.fg_status === "ok" ? (
                  <span className="pill text-ok">✓ {t("pool.topic")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-mute">{t("pool.topic")}:</span>
                    <button type="button" className="btn h-7 min-h-0 px-2 py-0 text-xs" onClick={() => save(d.id, [{ field: "fg_status", value: "ok" }])} aria-label={t("pool.topicOk")}>
                      ✓
                    </button>
                    <button
                      type="button"
                      className="btn h-7 min-h-0 px-2 py-0 text-xs"
                      onClick={() => save(d.id, [{ field: "reject_reason", value: "topic" }, { field: "fg_status", value: "out" }])}
                      aria-label={t("pool.topicNo")}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            )}
            {col === "fit" && d.fg_status === "ok" && (
              <button type="button" className="btn btn-pri h-8 min-h-0 py-0 text-xs" onClick={() => save(d.id, [{ field: "fg_status", value: "core" }])}>
                {t("pool.toWork")}
              </button>
            )}
            {col === "out" && (
              <select aria-label={t("pool.reason")} className="inp h-8 min-h-0 py-0 text-xs" value={d.reject_reason} onChange={(e) => save(d.id, [{ field: "reject_reason", value: e.target.value }])}>
                <option value="">{t("pool.reason")}…</option>
                {REJECT_REASONS.map((r) => <option key={r} value={r}>{t(`rej.${r}` as MsgKey)}</option>)}
              </select>
            )}
          </div>
        );
      }}
    />
  );
}
