// Главное меню в два уровня:
//   Загальне (не относится к проекту): Дашборд · Проєкти (карточки) · Confero (глобальная база, інпут)
//   Проєкт (после выбора карточки): Prefero · Outreach · Моніторинг · Налаштування
// also — страницы, которые относятся к пункту (подсветка пункта и название в верхней панели).
import type { MsgKey } from "@/lib/i18n/config";

export type NavItem = { href: string; key: MsgKey; icon: string; exact?: boolean; also: string[] };

export const TEAM_NAV: NavItem[] = [
  { href: "/app", key: "nav.dashboard", icon: "dash", exact: true, also: ["/app/today", "/app/finance", "/app/tasks"] },
  { href: "/app/projects", key: "common.projects", icon: "folder", also: [] },
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

export const ALL_NAV: NavItem[] = [...TEAM_NAV, ...PROJECT_NAV, ...ACCOUNT_NAV];

// Нижнее меню телефона: общие разделы + «Меню». Разделы проекта — вкладками вверху страницы проекта.
export const MOBILE_NAV: NavItem[] = TEAM_NAV;

export function isActive(path: string, it: { href: string; exact?: boolean; also?: string[] }): boolean {
  const hit = (h: string) => path === h || path.startsWith(h + "/");
  return (it.exact ? path === it.href : hit(it.href)) || (it.also ?? []).some(hit);
}
