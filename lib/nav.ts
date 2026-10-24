// Главное меню: 4 модуля. also — страницы, которые относятся к модулю (подсветка пункта).
import type { MsgKey } from "@/lib/i18n/config";

export const MODULES: { href: string; key: MsgKey; icon: string; exact?: boolean; also: string[] }[] = [
  { href: "/app", key: "nav.dashboard", icon: "dash", exact: true, also: ["/app/today", "/app/finance", "/app/tasks"] },
  { href: "/app/domains", key: "ptab.pool", icon: "global", also: ["/app/global", "/app/input", "/app/import"] },
  { href: "/app/outreach", key: "ptab.outreach", icon: "chat", also: ["/app/inbox", "/app/intermediaries", "/app/writers", "/app/templates"] },
  { href: "/app/monitoring", key: "ptab.monitor", icon: "shield", also: [] },
];
