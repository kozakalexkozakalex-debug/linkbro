"use client";

// Глобальный выбор проекта в верхней панели: «Усі проєкти» или конкретный проект.
// Выбор хранится в cookie (через /app/scope) и сохраняется при переходах между разделами.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { projectDot } from "@/lib/projectColor";


export default function ProjectPicker({ projects, current, isLead, wide = false }: { projects: { id: string; name: string }[]; current: string | null; isLead: boolean; wide?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const idx = projects.findIndex((p) => p.id === current);
  const name = idx >= 0 ? projects[idx].name : t("dash.allProjects");

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return projects.map((p, i) => ({ ...p, dot: projectDot(i) })).filter((p) => !s || p.name.toLowerCase().includes(s));
  }, [projects, q]);

  function pick(id: string) {
    setOpen(false);
    setQ("");
    // Со страницы конкретного проекта возвращаемся на дашборд, иначе остаёмся в разделе
    const back = path.startsWith("/app/projects/") ? "/app" : path;
    router.push(`/app/scope?p=${encodeURIComponent(id)}&next=${encodeURIComponent(back)}`);
  }

  return (
    <div ref={box} className={`relative min-w-0 ${wide ? "flex-1" : ""}`}>
      <button type="button" className={`picker ${wide ? "w-full" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} title={t("nav.project")}>
        <span className="picker-dot" style={{ background: idx >= 0 ? projectDot(idx) : "var(--mute)" }} />
        <span className="min-w-0 flex-1 truncate text-left font-semibold">{name}</span>
        <Icon name="chevron" size={12} className="text-mute" />
      </button>
      {open && (
        <div className="menu-pop left-0 w-72" role="listbox" aria-label={t("nav.project")}>
          {projects.length > 6 && (
            <input autoFocus className="inp mb-1" placeholder={t("nav.findProject")} aria-label={t("nav.findProject")} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <button type="button" role="option" aria-selected={!current} className={`menu-item ${!current ? "menu-on" : ""}`} onClick={() => pick("all")}>
            <span className="picker-dot" style={{ background: "var(--mute)" }} />
            <span className="flex-1 truncate">{t("dash.allProjects")}</span>
            {!current && <Icon name="check" size={14} className="text-accent" />}
          </button>
          <div className="max-h-72 overflow-y-auto">
            {list.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected={p.id === current} className={`menu-item ${p.id === current ? "menu-on" : ""}`} onClick={() => pick(p.id)}>
                <span className="picker-dot" style={{ background: p.dot }} />
                <span className="flex-1 truncate">{p.name}</span>
                {p.id === current && <Icon name="check" size={14} className="text-accent" />}
              </button>
            ))}
          </div>
          {isLead && (
            <div className="mt-1 border-t border-line pt-1">
              <button type="button" className="menu-item" onClick={() => { setOpen(false); router.push("/app/projects/new"); }}>
                <Icon name="plus" size={14} className="text-mute" />
                <span>{t("nav.newProject")}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
