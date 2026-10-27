"use client";

// Верхняя панель.
//   Общие разделы: название раздела (и вкладки).
//   Внутри проекта: «Проєкти / <проект>» и под ним вкладки проекта, как в браузере: Prefero · Outreach · Моніторинг · Налаштування.
// Проект выбирается только на странице «Проєкти» (карточки) — отдельного выпадающего списка нет.
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { MODULE_TABS } from "@/components/ModuleTabs";
import { useI18n } from "@/components/I18nProvider";
import { ALL_NAV, PROJECT_NAV, isActive } from "@/lib/nav";

export function toggleNav(open?: boolean) {
  document.documentElement.toggleAttribute("data-nav-open", open);
}

export default function TopBar({ project, dot }: { project: string | null; dot: string }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const inProject = PROJECT_NAV.some((n) => isActive(path, n));
  const section = ALL_NAV.find((n) => isActive(path, n));
  // Вкладка внутри раздела — самое точное совпадение по адресу
  const tab = Object.values(MODULE_TABS)
    .flat()
    .filter((x) => (x.exact ? path === x.href : path === x.href || path.startsWith(x.href + "/")) || (x.also ?? []).some((a) => path.startsWith(a)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const tabLabel = tab && section && tab.href !== section.href ? t(tab.key) : null;

  return (
    <div className="topbar-wrap">
      <header className="topbar">
        <button type="button" className="icon-btn m-only" aria-label={t("nav.menu")} onClick={() => toggleNav(true)}>
          <Icon name="menu" size={20} />
        </button>
        <nav aria-label={t("nav.where")} className="crumbs">
          {inProject ? (
            <>
              <Link href="/app/projects" className="hover:text-ink">{t("common.projects")}</Link>
              <span aria-hidden="true">/</span>
              <span className="picker-dot" style={{ background: project ? dot : "var(--mute)" }} />
              <span className="truncate font-semibold text-ink">{project ?? t("dash.allProjects")}</span>
            </>
          ) : (
            <>
              <span className={tabLabel ? "" : "font-semibold text-ink"}>{section ? t(section.key) : "LinkBro"}</span>
              {tabLabel && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="truncate font-semibold text-ink">{tabLabel}</span>
                </>
              )}
            </>
          )}
        </nav>
        {inProject && (
          <Link href="/app/projects" className="btn btn-ghost btn-sm ml-auto d-only">
            {t("nav.changeProject")}
          </Link>
        )}
      </header>

      {inProject && (
        <nav className="ptabs" aria-label={project ?? t("dash.allProjects")}>
          {PROJECT_NAV.map((n) => {
            const on = isActive(path, n);
            return (
              <Link key={n.href} href={n.href} className={`ptab ${on ? "ptab-on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={n.icon} size={14} />
                {t(n.key)}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
