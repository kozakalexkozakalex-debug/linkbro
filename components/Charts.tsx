// Простые графики на SVG без библиотек. Цвета из темы, подсказка при наведении (title).

export type BarDatum = { label: string; value: number; hint?: string };

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("uk-UA");

// Столбцы по месяцам. target — пунктирная линия плана (например, план публикаций).
export function MonthBars({
  data,
  target,
  targetLabel,
  format = fmt,
  height = 160,
}: {
  data: BarDatum[];
  target?: number | null;
  targetLabel?: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const W = 560;
  const H = height;
  const top = 22;
  const bottom = 26;
  const plot = H - top - bottom;
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));
  const step = W / Math.max(1, data.length);
  const bw = Math.min(46, step * 0.56);
  const y = (v: number) => top + plot - (v / max) * plot;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      <line x1="0" x2={W} y1={top + plot} y2={top + plot} stroke="var(--line)" strokeWidth="1" />
      {target != null && target > 0 && (
        <g>
          <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="var(--mute)" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={W - 4} y={y(target) - 5} textAnchor="end" fontSize="11" fill="var(--mute)">
            {targetLabel ?? ""} {format(target)}
          </text>
        </g>
      )}
      {data.map((d, i) => {
        const cx = step * i + step / 2;
        const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plot);
        const last = i === data.length - 1;
        return (
          <g key={d.label}>
            <title>{d.hint ?? `${d.label}: ${format(d.value)}`}</title>
            <rect x={cx - step / 2} y={top} width={step} height={plot} fill="transparent" />
            <rect
              x={cx - bw / 2}
              y={top + plot - h}
              width={bw}
              height={h}
              rx="4"
              fill="var(--accent)"
              opacity={last ? 1 : 0.55}
            />
            {(last || d.value > 0) && (
              <text x={cx} y={top + plot - h - 6} textAnchor="middle" fontSize="11" fill="var(--ink)" fontWeight={last ? 600 : 400}>
                {format(d.value)}
              </text>
            )}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--mute)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Горизонтальные полосы (воронка, причины отсева, статусы)
export function HBars({
  data,
  format = fmt,
  tone,
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  tone?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
      {data.map((d) => (
        <div key={d.label} className="contents" title={d.hint}>
          <span className="truncate">{d.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: tone?.(d.label) ?? "var(--accent)" }}
            />
          </div>
          <span className="text-right font-mono tabular-nums">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Полоса прогресса «факт / цель» с переходом в предупреждение после 100%
export function Progress({ value, max, warnOver = false }: { value: number; max: number; warnOver?: boolean }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  const over = warnOver && p > 100;
  return (
    <div className="h-2.5 min-w-16 overflow-hidden rounded-full bg-line" title={`${Math.round(p)}%`}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: over ? "var(--bad)" : "var(--accent)" }} />
    </div>
  );
}

// Плитка показателя с изменением к прошлому месяцу
export function Kpi({
  label,
  value,
  sub,
  delta,
  goodWhenUp = true,
  vs = "",
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  goodWhenUp?: boolean;
  vs?: string;
}) {
  let deltaEl = null;
  if (delta != null && Number.isFinite(delta) && delta !== 0) {
    const up = delta > 0;
    const good = up === goodWhenUp;
    deltaEl = (
      <span className={`pill ${good ? "pill-ok" : "pill-bad"}`}>
        {up ? "▲" : "▼"} {Math.abs(Math.round(delta))}% {vs}
      </span>
    );
  }
  return (
    <div className="card flex min-w-0 flex-col gap-1">
      <p className="lbl">{label}</p>
      <p className="truncate text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
        {deltaEl}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
