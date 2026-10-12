"use client";

import { useState, useTransition } from "react";
import { updateDonorField } from "@/app/app/projects/actions";
import type { DonorTextField } from "@/lib/project";

// Ячейка таблицы проекта: сохраняется, когда уходишь из поля или жмёшь Enter.
export default function DonorCell({
  id,
  field,
  value,
  width = 150,
  placeholder,
  mono,
  onSaved,
}: {
  id: string;
  field: DonorTextField;
  value: string | number | null;
  width?: number;
  placeholder?: string;
  mono?: boolean;
  onSaved?: (value: string) => void;
}) {
  const initial = value == null ? "" : String(value);
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (v === saved) return;
    start(async () => {
      const r = await updateDonorField(id, field, v);
      if (r.ok) {
        setError(null);
        setSaved(v);
        onSaved?.(v);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <input
      id={`d-${id}-${field}`}
      aria-label={field}
      title={error ?? (v || undefined)}
      placeholder={placeholder}
      style={{ width }}
      className={`cell cell-box ${mono ? "" : "cell-text"} ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
