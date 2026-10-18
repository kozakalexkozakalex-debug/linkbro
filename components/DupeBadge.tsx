"use client";

import { useI18n } from "@/components/I18nProvider";

// Предупреждение: этот донор или посредник уже в работе в другом проекте или у другого человека.
export default function DupeBadge({ items, label }: { items?: string[]; label?: string }) {
  const { t } = useI18n();
  if (!items || items.length === 0) return null;
  return (
    <span className="pill pill-warn ml-1 cursor-help font-sans font-normal" title={items.join("\n")}>
      ⚠ {label ?? t("dupe.alsoIn")}: {items.length}
    </span>
  );
}
