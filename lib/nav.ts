// Главное меню:
//   Загальне (не относится к проекту): Дашборд · Confero (глобальная база, інпут)
//   Проєкти (выбор во всплывающем списке, «+» — новый): Prefero · Outreach · Моніторинг · Налаштування
// also — страницы, которые относятся к пункту (подсветка пункта и название в верхней панели).
import type { MsgKey } from "@/lib/i18n/config";

export type NavItem = { href: string; key: MsgKey; icon: string; exact?: boolean; also: string[] };

export const TEAM_NAV: NavItem[] = [
  { href: "/app", key: "nav.dashboard", icon: "dash", exact: true, also: ["/app/today", "/app/finance", "/app/tasks"] },
  { href: "/app/global", key: "dom.confero", icon: "globe", also: ["/app/input", "/app/import"] },
];

export const PROJECT_NAV: NavItem[] = [
  { href: "/app/domains", key: "dom.prefero", icon: "filter", also: [] },
  {
    href: "/app/outreach",
    key: "ptab.outreach",
    icon: "chat",
    also: ["/app/followup", "/app/articles", "/app/campaigns", "/app/inbox", "/app/intermediaries", "/app/writers", "/app/templates"],
  },
  { href: "/app/monitoring", key: "ptab.monitor", icon: "shield", also: [] },
  { href: "/app/settings", key: "mod.settingsShort", icon: "gear", also: [] },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/app/mail", key: "nav.mail", icon: "mail", also: [] },
  { href: "/app/team", key: "team.title", icon: "users", also: [] },
];

export const PROJECTS_PAGE: NavItem = { href: "/app/projects", key: "common.projects", icon: "folder", also: [] };

export const ALL_NAV: NavItem[] = [...TEAM_NAV, PROJECTS_PAGE, ...PROJECT_NAV, ...ACCOUNT_NAV];

// Нижнее меню телефона: общие разделы + «Меню». Разделы проекта — вкладками вверху страницы проекта.
export const MOBILE_NAV: NavItem[] = [TEAM_NAV[0], TEAM_NAV[1], PROJECTS_PAGE];

export function isActive(path: string, it: { href: string; exact?: boolean; also?: string[] }): boolean {
  const hit = (h: string) => path === h || path.startsWith(h + "/");
  return (it.exact ? path === it.href : hit(it.href)) || (it.also ?? []).some(hit);
}
