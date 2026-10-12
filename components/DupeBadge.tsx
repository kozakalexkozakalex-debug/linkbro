// Предупреждение: этот донор или посредник уже в работе в другом проекте или у другого человека.
export default function DupeBadge({ items, label = "ще в" }: { items?: string[]; label?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <span className="pill pill-warn ml-1 cursor-help font-sans font-normal" title={items.join("\n")}>
      ⚠ {label}: {items.length}
    </span>
  );
}
