"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDonorValue, type DonorValueField } from "@/app/app/projects/actions";

// Поле донора с бизнес-логикой на сервере (валюта, комиссия, оплата, гарантия, источник, индексация).
export function DonorValueSelect({
  id,
  projectId,
  field,
  value,
  options,
  tone,
}: {
  id: string;
  projectId: string;
  field: DonorValueField;
  value: string;
  options: readonly { value: string; label: string }[];
  tone?: (v: string) => string;
}) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <select
      id={`dv-${id}-${field}`}
      aria-label={field}
      title={error ?? undefined}
      className={`stsel ${tone?.(v) ?? ""} ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => {
        const next = e.target.value;
        const prev = v;
        setV(next);
        start(async () => {
          const r = await setDonorValue(id, projectId, field, next);
          if (!r.ok) {
            setV(prev);
            setError(r.error);
          } else {
            setError(null);
            router.refresh();
          }
        });
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function DonorValueInput({
  id,
  projectId,
  field,
  value,
  type = "text",
  width = 90,
  list,
  placeholder,
}: {
  id: string;
  projectId: string;
  field: DonorValueField;
  value: string;
  type?: "text" | "date";
  width?: number;
  list?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(value);
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: string) {
    if (next === saved) return;
    start(async () => {
      const r = await setDonorValue(id, projectId, field, next);
      if (r.ok) {
        setSaved(next);
        setError(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <input
      id={`dv-${id}-${field}`}
      aria-label={field}
      type={type}
      list={list}
      placeholder={placeholder}
      title={error ?? undefined}
      style={{ width }}
      className={`cell cell-box ${type === "text" ? "" : "cell-text"} ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        if (type === "date") save(e.target.value);
      }}
      onBlur={() => type === "text" && save(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
