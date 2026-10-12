"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomStatus } from "@/app/app/projects/actions";
import type { Opt } from "@/lib/sheet";

type Result = { ok: boolean; error?: string };

// Выпадающий список на панели массовых действий: выбрал значение — применилось ко всем выбранным строкам
export function BulkSelect({ label, options, onApply }: { label: string; options: Opt[]; onApply: (value: string) => Promise<Result> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <select
        aria-label={label}
        className={`stsel ${pending ? "opacity-60" : ""}`}
        value=""
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__none") return;
          start(async () => {
            const r = await onApply(v === "__empty" ? "" : v);
            setError(r.ok ? null : r.error ?? "Помилка");
            router.refresh();
          });
        }}
      >
        <option value="" disabled>{label}…</option>
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value || "__empty"}>{o.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}

export function BulkButton({ label, onApply }: { label: string; onApply: () => Promise<Result> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await onApply();
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}

// Кнопка «+ свій статус» над таблицей
export function AddStatus({ kinds }: { kinds: { value: "core_pos" | "core_neg" | "comm"; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kinds[0].value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>+ свій статус</button>
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="card flex w-full max-w-sm flex-col gap-3" role="dialog" aria-label="Свій статус">
            <h2 className="font-display text-lg font-medium">Свій статус</h2>
            <p className="text-sm text-mute">Збережеться для всієї команди і з&apos;явиться у списках.</p>
            <div className="field">
              <label htmlFor="cs-name" className="lbl">Назва</label>
              <input id="cs-name" className="inp" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            {kinds.length > 1 && (
              <div className="field">
                <label htmlFor="cs-kind" className="lbl">Тип</label>
                <select id="cs-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
            )}
            {error && <p className="note note-bad">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-pri"
                disabled={pending || !name.trim()}
                onClick={() =>
                  start(async () => {
                    const r = await addCustomStatus(kind, name);
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setOpen(false);
                    setName("");
                    router.refresh();
                  })
                }
              >
                Додати
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
