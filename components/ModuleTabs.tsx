"use client";

// Вкладки внутри модуля (Дашборд / Домени / Outreach)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export const MODULE_TABS: Record<string, { href: string; key: MsgKey; exact?: boolean }[]> = {
  dashboard: [
    { href: "/app", key: "ptab.overview", exact: true },
    { href: "/app/today", key: "nav.today" },
    { href: "/app/finance", key: "nav.money" },
    { href: "/app/tasks", key: "nav.tasks" },
  ],
  domains: [
    { href: "/app/domains", key: "mod.pool" },
    { href: "/app/global", key: "mod.global" },
    { href: "/app/input", key: "nav.add" },
    { href: "/app/import", key: "nav.import" },
  ],
  outreach: [
    { href: "/app/outreach", key: "mod.board" },
    { href: "/app/inbox", key: "nav.inbox" },
    { href: "/app/intermediaries", key: "nav.contacts" },
    { href: "/app/writers", key: "nav.writers" },
    { href: "/app/templates", key: "nav.templates" },
  ],
};

export default function ModuleTabs({ module }: { module: keyof typeof MODULE_TABS }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label={t("nav.menu")}>
      {MODULE_TABS[module].map((it) => {
        const on = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={`tab whitespace-nowrap ${on ? "tab-on" : ""}`} aria-current={on ? "page" : undefined}>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
