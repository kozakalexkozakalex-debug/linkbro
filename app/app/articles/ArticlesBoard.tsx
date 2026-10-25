"use client";

// Дошка статей: ТЗ → Пишеться → Правки → Готова → У видавця → Видавець прийняв.
// Перетягування міняє статус статті (і підтягує етап угоди). Натиснули картку — угода на вкладці «Стаття».
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Board from "@/components/Board";
import { setArticle } from "@/app/app/projects/deal-actions";
import DonorCard from "@/app/app/projects/[id]/DonorCard";
import { ART_COLS, ART_KEY, MODE_KEY } from "@/lib/articles";
import { STAGES, STAGE_KEY } from "@/lib/stages";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

export default function ArticlesBoard({ rows, projects }: { rows: ProjectDonor[]; projects: Record<string, string> }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [card, setCard] = useState<ProjectDonor | null>(null);
  const cols = useMemo(() => ART_COLS.map((c) => ({ key: c as string, label: t(ART_KEY[c]), tone: (c === "accepted" ? "ok" : "") as "ok" | "" })), [t]);
  const statusOpts = useMemo(
    () => [...STAGES.map((s) => ({ value: s as string, label: t(STAGE_KEY[s]) })), { value: "lost", label: `✕ ${t(STAGE_KEY.lost)}` }],
    [t],
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Board
        cols={cols}
        items={rows}
        colOf={(d) => d.article_status || "todo"}
        onMove={async (d, to) => {
          const r = await setArticle({ projectId: d.project_id, donorId: d.id, status: to });
          router.refresh();
          return r;
        }}
        card={(d) => {
          const late = d.article_deadline && d.article_deadline < today && d.article_status !== "accepted";
          return (
            <button type="button" className="block w-full text-left" onClick={() => setCard(d)}>
              <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
              {projects[d.project_id] && <span className="block truncate text-xs text-mute">{projects[d.project_id]}</span>}
              <span className="block truncate text-xs">
                {d.article_mode === "publisher" ? t(MODE_KEY.publisher) : d.article_mode === "ready" ? t(MODE_KEY.ready) : d.article_writer || <span className="text-mute">{t("art.noWriter")}</span>}
              </span>
              {d.article_deadline && (
                <span className={`block font-mono text-xs ${late ? "text-bad font-semibold" : "text-mute"}`} suppressHydrationWarning>
                  {late ? "⚠ " : ""}{new Date(d.article_deadline).toLocaleDateString(intl, { day: "2-digit", month: "2-digit" })}
                </span>
              )}
            </button>
          );
        }}
      />
      {card && <DonorCard projectId={card.project_id} donor={card} statusOpts={statusOpts} initialTab="article" onClose={() => setCard(null)} />}
    </>
  );
}
