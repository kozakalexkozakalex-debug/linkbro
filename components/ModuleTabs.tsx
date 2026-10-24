"use client";

// Вкладки внутри модуля (Дашборд / Домени / Outreach)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";
import InferoButton from "@/components/InferoButton";

export const MODULE_TABS: Record<string, { href: string; key: MsgKey; sub?: MsgKey; exact?: boolean }[]> = {
  dashboard: [
    { href: "/app", key: "ptab.overview", exact: true },
    { href: "/app/today", key: "nav.today" },
    { href: "/app/finance", key: "nav.money" },
    { href: "/app/tasks", key: "nav.tasks" },
  ],
  domains: [
    { href: "/app/global", key: "dom.confero", sub: "dom.conferoSub" },
    { href: "/app/domains", key: "dom.prefero", sub: "dom.preferoSub" },
  ],
  outreach: [
    { href: "/app/outreach", key: "mod.board" },
    { href: "/app/followup", key: "out.followup" },
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
    <nav className="flex items-end gap-1 overflow-x-auto border-b border-line" aria-label={t("nav.menu")}>
      {MODULE_TABS[module].map((it) => {
        const on = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={`tab whitespace-nowrap ${on ? "tab-on" : ""}`} aria-current={on ? "page" : undefined}>
            {it.sub ? (
              <span className="flex flex-col leading-tight">
                <span>{t(it.key)}</span>
                <span className="text-[10px] font-normal text-mute">{t(it.sub)}</span>
              </span>
            ) : (
              t(it.key)
            )}
          </Link>
        );
      })}
      {module === "domains" && (
        <span className="ml-auto shrink-0 pb-1.5 pl-2">
          <InferoButton />
        </span>
      )}
    </nav>
  );
}
