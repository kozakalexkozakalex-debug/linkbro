// Главное меню. Сверху — общее для команды (Дашборд, Confero), ниже — разделы выбранного проекта.
// also — страницы, которые относятся к пункту (подсветка пункта).
import type { MsgKey } from "@/lib/i18n/config";

export type NavItem = { href: string; key: MsgKey; icon: string; exact?: boolean; also: string[] };

export const TEAM_NAV: NavItem[] = [
  { href: "/app", key: "nav.dashboard", icon: "dash", exact: true, also: ["/app/today", "/app/finance", "/app/tasks"] },
  { href: "/app/global", key: "dom.confero", icon: "global", also: ["/app/input", "/app/import"] },
];

export const PROJECT_NAV: NavItem[] = [
  { href: "/app/domains", key: "dom.prefero", icon: "tasks", also: [] },
  { href: "/app/followup", key: "ptab.outreach", icon: "chat", also: ["/app/outreach", "/app/articles", "/app/campaigns", "/app/inbox", "/app/intermediaries", "/app/writers", "/app/templates"] },
  { href: "/app/monitoring", key: "ptab.monitor", icon: "shield", also: [] },
];

export const SETTINGS_NAV: NavItem = { href: "/app/settings", key: "mod.settingsShort", icon: "gear", also: [] };

// Нижнее меню телефона: всё, кроме настроек (они в «Меню»)
export const MODULES: NavItem[] = [...TEAM_NAV, ...PROJECT_NAV];
