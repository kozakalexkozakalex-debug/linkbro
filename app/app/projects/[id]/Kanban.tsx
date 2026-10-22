"use client";

// Канбан: донор — карточка, этапы — колонки. На компьютере карточки перетаскиваются,
// на телефоне колонки листаются вбок, а кнопки ← → двигают карточку по этапам.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import { STAGES, STAGE_KEY, moveTo, stageOf, type Stage } from "@/lib/stages";
import { ageLabel, hoursSince, type ProjectDonor } from "@/lib/project";
import { fmtAmount } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";

export default function Kanban({ projectId, rows, customNeg, onOpen }: { projectId: string; rows: ProjectDonor[]; customNeg: string[]; onOpen: (d: ProjectDonor) => void }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<Stage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);

  const by = useMemo(() => {
    const m = new Map<Stage, ProjectDonor[]>();
    for (const d of rows) {
      const s = stageOf(d, customNeg);
      m.set(s, [...(m.get(s) ?? []), d]);
    }
    return m;
  }, [rows, customNeg]);

  function move(d: ProjectDonor, to: Stage) {
    const ch = moveTo(to).map((c) => ({ id: d.id, ...c }));
    if (!ch.length) return;
    start(async () => {
      const r = await updateDonorsBatch(projectId, ch);
      setErr(r.ok ? null : r.error);
      router.refresh();
    });
  }

  const cols: Stage[] = showDropped ? [...STAGES, "dropped"] : [...STAGES];

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-mute">
        <input type="checkbox" checked={showDropped} onChange={(e) => setShowDropped(e.target.checked)} />
        {t("stage.showDropped", { n: by.get("dropped")?.length ?? 0 })}
      </label>
      {err && <p className="note note-bad">{err}</p>}
      <div className={`kanban ${pending ? "opacity-60" : ""}`}>
        {cols.map((s) => {
          const list = by.get(s) ?? [];
          const i = STAGES.indexOf(s as (typeof STAGES)[number]);
          return (
            <section
              key={s}
              className={`kan-col ${over === s ? "kan-over" : ""}`}
              onDragOver={(e: { preventDefault(): void }) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e: { dataTransfer: { getData(k: string): string } }) => {
                setOver(null);
                const d = rows.find((r) => r.id === e.dataTransfer.getData("text/plain"));
                if (d && stageOf(d, customNeg) !== s) move(d, s);
              }}
            >
              <h3 className="kan-head">
                {t(STAGE_KEY[s])} <span className="font-mono text-xs text-mute">{list.length}</span>
              </h3>
              <div className="flex flex-col gap-2">
                {list.map((d) => {
                  const hrs = d.indicator === "waiting" ? hoursSince(d.indicator_at) : null;
                  return (
                    <article
                      key={d.id}
                      className="kan-card"
                      draggable
                      onDragStart={(e: { dataTransfer: { setData(k: string, v: string): void } }) => e.dataTransfer.setData("text/plain", d.id)}
                    >
                      <button type="button" className="block w-full text-left" onClick={() => onOpen(d)}>
                        <span className="block truncate font-mono text-sm font-semibold">{d.domain}</span>
                        <span className="block truncate text-xs text-mute">{d.med_base || t("stage.noMed")}</span>
                        <span className="mt-1 flex flex-wrap gap-1 text-xs">
                          {d.gp_price != null && <span className="pill">{fmtAmount(d.gp_price, d.gp_currency || "USD", intl)}</span>}
                          {hrs != null && (
                            <span className={`pill ${hrs > 72 ? "pill-bad" : hrs > 24 ? "pill-warn" : ""}`} suppressHydrationWarning>{ageLabel(hrs, t)}</span>
                          )}
                        </span>
                      </button>
                      {i >= 0 && (
                        <div className="mt-2 flex justify-between gap-1">
                          <button type="button" className="btn btn-sm" disabled={i === 0 || pending} onClick={() => move(d, STAGES[i - 1])} aria-label={t("stage.back")}>←</button>
                          <button type="button" className="btn btn-sm flex-1" disabled={i === STAGES.length - 1 || pending} onClick={() => move(d, STAGES[i + 1])}>
                            {i < STAGES.length - 1 ? `${t(STAGE_KEY[STAGES[i + 1]])} →` : "✓"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
