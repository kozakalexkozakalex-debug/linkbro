"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type StatusGroup = { label?: string; options: string[] };

// Выпадающий список статуса. Опция «+ свій статус…» открывает маленькое окно.
export default function StatusSelect({
  id,
  value,
  groups,
  tone,
  emptyLabel,
  onChange,
  onAddCustom,
  addKinds,
}: {
  id: string;
  value: string;
  groups: StatusGroup[];
  tone?: (v: string) => "ok" | "bad" | "";
  emptyLabel?: string;
  onChange: (v: string) => Promise<{ ok: boolean; error?: string }>;
  onAddCustom?: (kind: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  addKinds?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(addKinds?.[0]?.value ?? "");

  function apply(next: string) {
    const prev = v;
    setV(next);
    start(async () => {
      const r = await onChange(next);
      if (!r.ok) {
        setV(prev);
        setError(r.error ?? "Помилка");
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  function addCustom() {
    const n = name.trim();
    if (!n || !onAddCustom) return;
    start(async () => {
      const r = await onAddCustom(kind, n);
      if (!r.ok) {
        setError(r.error ?? "Помилка");
        return;
      }
      setAdding(false);
      setName("");
      const r2 = await onChange(n);
      if (r2.ok) setV(n);
      else setError(r2.error ?? "Помилка");
      router.refresh();
    });
  }

  const t = tone?.(v) ?? "";
  const known = groups.some((g) => g.options.includes(v));

  return (
    <>
      <select
        id={id}
        aria-label="Статус"
        title={error ?? undefined}
        className={`stsel ${t === "ok" ? "stsel-ok" : t === "bad" ? "stsel-bad" : ""} ${error ? "cell-err" : ""} ${pending ? "opacity-60" : ""}`}
        value={v}
        disabled={pending}
        onChange={(e) => {
          if (e.target.value === "__add") setAdding(true);
          else apply(e.target.value);
        }}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {v && !known && <option value={v}>{v}</option>}
        {groups.map((g, i) =>
          g.label ? (
            <optgroup key={i} label={g.label}>
              {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </optgroup>
          ) : (
            g.options.map((o) => <option key={o} value={o}>{o}</option>)
          ),
        )}
        {onAddCustom && <option value="__add">+ свій статус…</option>}
      </select>

      {adding && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setAdding(false)}>
          <div className="card flex w-full max-w-sm flex-col gap-3" role="dialog" aria-label="Свій статус">
            <h2 className="font-display text-lg font-medium">Свій статус</h2>
            <p className="text-sm text-mute">Збережеться для всієї команди і з&apos;явиться в списку.</p>
            <div className="field">
              <label htmlFor={`${id}-new`} className="lbl">Назва</label>
              <input id={`${id}-new`} className="inp" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            {addKinds && addKinds.length > 1 && (
              <div className="field">
                <label htmlFor={`${id}-kind`} className="lbl">Тип</label>
                <select id={`${id}-kind`} className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {addKinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn btn-pri" onClick={addCustom} disabled={pending || !name.trim()}>
                Додати і застосувати
              </button>
              <button type="button" className="btn" onClick={() => setAdding(false)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
