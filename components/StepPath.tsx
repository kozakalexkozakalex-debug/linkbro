// Линия этапов с точками: зелёная — пройдено, оранжевая обводка — сейчас, красная — не получилось, серая — впереди.
// Общая для Prefero и Outreach (стили .path* в globals.css).
export type StepMark = "ok" | "now" | "todo" | "no" | "warn" | "?";

const COLOR: Record<StepMark, string> = {
  ok: "var(--ok)",
  no: "var(--bad)",
  warn: "var(--accent)",
  now: "var(--accent)",
  todo: "var(--line-strong)",
  "?": "var(--line-strong)",
};

export default function StepPath({ steps, compact = false, onClick, title }: { steps: { label: string; mark: StepMark; title?: string }[]; compact?: boolean; onClick?: () => void; title?: string }) {
  const body = steps.map((s, i) => {
    const filled = s.mark === "ok" || s.mark === "no" || s.mark === "warn";
    return (
      <span key={s.label + i} className={`path-step ${compact ? "" : "path-wide"}`} title={s.title ?? s.label}>
        {i > 0 && <span className="path-line" style={{ background: steps[i - 1].mark === "ok" ? "var(--ok)" : "var(--line-strong)" }} />}
        <span
          className={`path-dot ${s.mark === "now" ? "path-now" : ""}`}
          style={{ background: filled ? COLOR[s.mark] : "var(--bg)", borderColor: COLOR[s.mark] }}
        >
          {s.mark === "ok" ? "✓" : s.mark === "no" ? "✕" : s.mark === "warn" ? "!" : ""}
        </span>
        <span className={`path-label ${s.mark === "now" ? "text-accent font-semibold" : s.mark === "no" ? "text-bad" : s.mark === "todo" || s.mark === "?" ? "text-mute" : ""}`}>{s.label}</span>
      </span>
    );
  });
  return onClick ? (
    <button type="button" className="path" onClick={onClick} title={title} aria-label={title}>
      {body}
    </button>
  ) : (
    <div className="path" role="img" aria-label={title ?? steps.map((s) => `${s.label}: ${s.mark}`).join(", ")}>
      {body}
    </div>
  );
}
