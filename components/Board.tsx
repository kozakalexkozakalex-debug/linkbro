"use client";

// Универсальная доска (канбан) для всех модулей: Огляд, Домени, Outreach, Моніторинг.
// Колонки листаются вбок, карточки перетаскиваются мышкой, на телефоне — кнопки ← →.
// В колонке рисуется до 30 карточек, остальные — по кнопке (скорость на телефоне).
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/analytics";

export type BoardCol = { key: string; label: string; hint?: string; tone?: "ok" | "bad" | "warn" | "" };

const PER_COL = 30;
const TONE = { ok: "border-t-ok", bad: "border-t-bad", warn: "border-t-warn", "": "" } as const;

export default function Board<T extends { id: string }>({
  cols,
  items,
  colOf,
  card,
  onMove,
  canMove = true,
  linear = true,
  monthOf,
  hidden = [],
  hiddenLabel,
  toolbar,
}: {
  cols: BoardCol[];
  items: T[];
  colOf: (it: T) => string;
  card: (it: T) => ReactNode;
  onMove?: (it: T, to: string) => Promise<{ ok: boolean; error?: string }>;
  canMove?: boolean;
  linear?: boolean; // показывать ли кнопки ← → (для колонок по порядку)
  monthOf?: (it: T) => { months: string[]; open: boolean }; // в каких месяцах показывать; open — незавершённое
  hidden?: string[]; // колонки, скрытые по умолчанию (отсеянные)
  hiddenLabel?: string;
  toolbar?: ReactNode;
}) {
  const { t, intl } = useI18n();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [openCols, setOpenCols] = useState<string[]>([]);
  const now = currentMonth();
  const [month, setMonth] = useState<string>(monthOf ? now : "all");

  const visible = useMemo(() => {
    if (!monthOf || month === "all") return items;
    return items.filter((it) => {
      const m = monthOf(it);
      return m.months.includes(month) || (month === now && m.open);
    });
  }, [items, month, monthOf, now]);

  const by = useMemo(() => {
    const m = new Map<string, T[]>();
    for (const it of visible) {
      const c = colOf(it);
      m.set(c, [...(m.get(c) ?? []), it]);
    }
    return m;
  }, [visible, colOf]);

  const shown = cols.filter((c) => showHidden || !hidden.includes(c.key));
  const order = cols.filter((c) => !hidden.includes(c.key)).map((c) => c.key);

  function move(it: T, to: string) {
    if (!onMove) return;
    start(async () => {
      const r = await onMove(it, to);
      setErr(r.ok ? null : r.error ?? t("common.error"));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {monthOf && (
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-sm" aria-label={t("dash.prevMonth")} onClick={() => setMonth(shiftMonth(month === "all" ? now : month, -1))}>←</button>
            <span className="min-w-28 text-center text-sm font-semibold capitalize">{month === "all" ? t("common.all") : monthLabel(month, "long", intl)}</span>
            <button type="button" className="btn btn-sm" aria-label={t("dash.nextMonth")} disabled={month === "all" || month >= now} onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
            <button type="button" className={`btn btn-sm ${month === "all" ? "btn-pri" : ""}`} onClick={() => setMonth(month === "all" ? now : "all")}>{t("common.all")}</button>
          </div>
        )}
        {hidden.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-mute">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            {hiddenLabel} ({hidden.reduce((a, h) => a + (by.get(h)?.length ?? 0), 0)})
          </label>
        )}
        {toolbar}
      </div>
      {err && <p className="note note-bad">{err}</p>}
      <div className={`kanban ${pending ? "opacity-60" : ""}`}>
        {shown.map((col) => {
          const list = by.get(col.key) ?? [];
          const i = order.indexOf(col.key);
          return (
            <section
              key={col.key}
              className={`kan-col border-t-2 ${TONE[col.tone ?? ""]} ${over === col.key ? "kan-over" : ""}`}
              onDragOver={(e: { preventDefault(): void }) => {
                if (!canMove) return;
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e: { dataTransfer: { getData(k: string): string } }) => {
                setOver(null);
                const it = items.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                if (it && colOf(it) !== col.key) move(it, col.key);
              }}
            >
              <h3 className="kan-head" title={col.hint}>
                <span className="truncate">{col.label}</span>
                <span className="font-mono text-xs text-mute">{list.length}</span>
              </h3>
              <div className="flex flex-col gap-2">
                {(openCols.includes(col.key) ? list : list.slice(0, PER_COL)).map((it) => (
                  <article
                    key={it.id}
                    className="kan-card"
                    draggable={canMove}
                    onDragStart={(e: { dataTransfer: { setData(k: string, v: string): void } }) => e.dataTransfer.setData("text/plain", it.id)}
                  >
                    {card(it)}
                    {canMove && linear && i >= 0 && (
                      <div className="mt-2 flex justify-between gap-1">
                        <button type="button" className="btn btn-sm" disabled={i === 0 || pending} onClick={() => move(it, order[i - 1])} aria-label={t("stage.back")}>←</button>
                        <button type="button" className="btn btn-sm min-w-0 flex-1" disabled={i === order.length - 1 || pending} onClick={() => move(it, order[i + 1])}>
                          <span className="truncate">{i < order.length - 1 ? `${cols.find((c) => c.key === order[i + 1])?.label} →` : "✓"}</span>
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {list.length > PER_COL && !openCols.includes(col.key) && (
                  <button type="button" className="btn btn-sm" onClick={() => setOpenCols([...openCols, col.key])}>
                    {t("sheet.more", { shown: PER_COL, total: list.length })}
                  </button>
                )}
                {list.length === 0 && <p className="px-1 py-3 text-center text-xs text-mute">—</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
