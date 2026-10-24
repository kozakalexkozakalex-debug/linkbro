"use client";

// Панель, которая выезжает справа. По умолчанию — пол-экрана, край можно потянуть мышкой/пальцем,
// «↗» открывает то же самое отдельной страницей. На телефоне — во весь экран.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

const KEY = "lb_drawer_w";
const MIN = 360;

export default function Drawer({
  open,
  onClose,
  title,
  sub,
  fullHref,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  fullHref?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [w, setW] = useState<number | null>(null);
  const drag = useRef(false);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      if (v >= MIN) setW(v);
    } catch {
      /* нет доступа к хранилищу — ширина по умолчанию */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const next = Math.min(window.innerWidth * 0.96, Math.max(MIN, window.innerWidth - e.clientX));
    setW(next);
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = false;
    try {
      if (w) localStorage.setItem(KEY, String(Math.round(w)));
    } catch {
      /* не сохранили — не страшно */
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        className="drawer absolute inset-y-0 right-0 flex flex-col border-l border-line bg-panel shadow-2xl"
        style={{ width: w ? `${w}px` : undefined }}
      >
        <div
          className="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize touch-none max-sm:hidden"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-hidden="true"
        >
          <span className="absolute left-1 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full" style={{ background: "var(--line-strong)" }} />
        </div>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-tight">{title}</p>
            {sub && <p className="text-xs text-mute">{sub}</p>}
          </div>
          {fullHref && (
            <Link href={fullHref} className="btn btn-sm" title={t("drawer.full")} onClick={onClose}>
              ↗
            </Link>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
