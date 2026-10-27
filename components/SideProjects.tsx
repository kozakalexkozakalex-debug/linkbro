"use client";

// Блок «Проєкти» в боковом меню: текущий проект (нажать — всплывающий список), «+» — новый проект.
// В списке: выбрать проект (сразу открывается Prefero), открыть страницу всех проектов, создать новый.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { selectProject } from "@/app/actions/scope";
import { projectDot } from "@/lib/projectColor";

export default function SideProjects({ projects, current, isLead }: { projects: { id: string; name: string }[]; current: string | null; isLead: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const idx = projects.findIndex((p) => p.id === current);

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

  const s = q.trim().toLowerCase();
  const list = projects.map((p, i) => ({ ...p, dot: projectDot(i) })).filter((p) => !s || p.name.toLowerCase().includes(s));

  return (
    <div ref={box} className="relative">
      <div className="side-projhead">
        <button type="button" className="side-projbtn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="side-projlbl">{t("common.projects")}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="picker-dot" style={{ background: idx >= 0 ? projectDot(idx) : "var(--mute)" }} />
            <span className="min-w-0 flex-1 truncate">{idx >= 0 ? projects[idx].name : t("nav.pickProject")}</span>
            <Icon name="chevron" size={12} className="text-mute" />
          </span>
        </button>
        {isLead && (
          <Link href="/app/projects/new" className="side-plus" aria-label={t("nav.newProject")} title={t("nav.newProject")}>
            <Icon name="plus" size={14} />
          </Link>
        )}
      </div>

      {open && (
        <div className="menu-pop left-0 right-0" role="listbox" aria-label={t("common.projects")}>
          {projects.length > 6 && (
            <input autoFocus className="inp mb-1" placeholder={t("nav.findProject")} aria-label={t("nav.findProject")} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <div className="max-h-72 overflow-y-auto">
            {list.map((p) => (
              <form key={p.id} action={selectProject}>
                <input type="hidden" name="p" value={p.id} />
                <input type="hidden" name="next" value="/app/domains" />
                <button type="submit" role="option" aria-selected={p.id === current} className={`menu-item ${p.id === current ? "menu-on" : ""}`}>
                  <span className="picker-dot" style={{ background: p.dot }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === current && <Icon name="check" size={14} className="text-accent" />}
                </button>
              </form>
            ))}
            {projects.length === 0 && <p className="px-2 py-1.5 text-xs text-mute">{t("nav.noProjectsYet")}</p>}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <Link href="/app/projects" className="menu-item" onClick={() => setOpen(false)}>
              <Icon name="folder" size={14} className="text-mute" />
              <span>{t("nav.allProjectsPage")}</span>
            </Link>
            {isLead && (
              <Link href="/app/projects/new" className="menu-item" onClick={() => setOpen(false)}>
                <Icon name="plus" size={14} className="text-mute" />
                <span>{t("nav.newProject")}</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
