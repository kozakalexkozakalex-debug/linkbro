"use client";

// Верхняя панель: где я (раздел / вкладка), выбор проекта. На телефоне — кнопка меню и выбор проекта.
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import ProjectPicker from "@/components/ProjectPicker";
import { MODULE_TABS } from "@/components/ModuleTabs";
import { useI18n } from "@/components/I18nProvider";
import { ALL_NAV, isActive } from "@/lib/nav";

export function toggleNav(open?: boolean) {
  document.documentElement.toggleAttribute("data-nav-open", open);
}

export default function TopBar({ projects, current, isLead }: { projects: { id: string; name: string }[]; current: string | null; isLead: boolean }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const section = ALL_NAV.find((n) => isActive(path, n));
  // Вкладка внутри раздела — самое точное совпадение по адресу
  const tab = Object.values(MODULE_TABS)
    .flat()
    .filter((x) => path === x.href || path.startsWith(x.href + "/") || (x.also ?? []).some((a) => path.startsWith(a)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const tabLabel = tab && section && tab.href !== section.href ? t(tab.key) : null;

  return (
    <header className="topbar">
      <button type="button" className="icon-btn m-only" aria-label={t("nav.menu")} onClick={() => toggleNav(true)}>
        <Icon name="menu" size={20} />
      </button>
      <nav aria-label={t("nav.where")} className="crumbs d-only">
        {section ? <span className={tabLabel ? "" : "text-ink font-semibold"}>{t(section.key)}</span> : <span>LinkBro</span>}
        {tabLabel && (
          <>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-ink">{tabLabel}</span>
          </>
        )}
      </nav>
      <div className="topbar-picker">
        <ProjectPicker projects={projects} current={current} isLead={isLead} wide />
      </div>
    </header>
  );
}
