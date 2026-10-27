// Статус одной формы на весь продукт: цветная точка + текст
type Tone = "ok" | "warn" | "bad" | "accent" | "mute" | "info";

export default function Badge({ tone = "mute", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
