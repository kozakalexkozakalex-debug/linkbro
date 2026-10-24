"use client";

// Домени проекта: пул кандидатов. Пул → Перевірка → Запас → В роботу (Outreach) / Відсіяно (з причиною).
// Відсіяне в одному проєкті лишається FIT у глобальній базі й може піти в інший проєкт.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import Board from "@/components/Board";
import { POOL, POOL_KEY, REJECT_REASONS } from "@/lib/stages";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export default function PoolBoard({ projectId, rows, onOpen }: { projectId: string; rows: ProjectDonor[]; onOpen: (d: ProjectDonor) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const cols = useMemo(
    () => POOL.map((p) => ({ key: p as string, label: t(POOL_KEY[p]), tone: (p === "core" ? "ok" : p === "out" ? "bad" : "") as "ok" | "bad" | "" })),
    [t],
  );
  const save = async (id: string, field: string, value: string) => {
    const r = await updateDonorsBatch(projectId, [{ id, field, value }]);
    router.refresh();
    return r;
  };
  return (
    <Board
      cols={cols}
      items={rows}
      colOf={(d) => d.fg_status}
      hidden={["out"]}
      hiddenLabel={t("pool.showOut")}
      monthOf={(d) => ({ months: [d.added_at.slice(0, 7)], open: ["new", "check", "ok"].includes(d.fg_status) })}
      onMove={(d, to) => save(d.id, "fg_status", to)}
      card={(d) => {
        const g = d.global_donors;
        return (
          <div className="flex flex-col gap-1">
            <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
              <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
              <span className="block font-mono text-xs text-mute">
                DR {g?.dr ?? "—"} · {g?.traffic ?? "—"} · {g?.geo || "—"}
              </span>
              {g?.topics && <span className="block truncate text-xs text-mute">{g.topics}</span>}
            </button>
            {d.fg_status === "out" && (
              <select aria-label={t("pool.reason")} className="inp h-8 min-h-0 py-0 text-xs" value={d.reject_reason} onChange={(e) => save(d.id, "reject_reason", e.target.value)}>
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
