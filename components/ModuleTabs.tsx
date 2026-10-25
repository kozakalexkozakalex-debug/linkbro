"use client";

// Вкладки внутри модуля (Дашборд / разделы проекта / Outreach)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export const MODULE_TABS: Record<string, { href: string; key: MsgKey; sub?: MsgKey; exact?: boolean }[]> = {
  dashboard: [
    { href: "/app", key: "ptab.overview", exact: true },
    { href: "/app/today", key: "nav.today" },
    { href: "/app/finance", key: "nav.money" },
    { href: "/app/tasks", key: "nav.tasks" },
  ],
  // Разделы проекта — одинаковый ряд на всех страницах проекта
  project: [
    { href: "/app/domains", key: "dom.prefero", sub: "dom.preferoSub" },
    { href: "/app/followup", key: "ptab.outreach", sub: "mod.outreachSub" },
    { href: "/app/monitoring", key: "ptab.monitor", sub: "mod.monitorSub" },
    { href: "/app/settings", key: "mod.settingsShort", sub: "mod.settingsSub" },
  ],
  outreach: [
    { href: "/app/followup", key: "out.followup" },
    { href: "/app/outreach", key: "mod.deals" },
    { href: "/app/articles", key: "art.tab" },
    { href: "/app/campaigns", key: "cmp.title" },
    { href: "/app/inbox", key: "nav.inbox" },
    { href: "/app/intermediaries", key: "nav.contacts" },
    { href: "/app/writers", key: "nav.writers" },
    { href: "/app/templates", key: "nav.templates" },
  ],
};

const OUTREACH_PAGES = ["/app/outreach", "/app/followup", "/app/articles", "/app/campaigns", "/app/inbox", "/app/intermediaries", "/app/writers", "/app/templates"];

// Ряд вкладок модуля. У Outreach сверху ещё ряд разделов проекта (Prefero · Outreach · Моніторинг · Налаштування).
export default function ModuleTabs({ module }: { module: keyof typeof MODULE_TABS }) {
  if (module === "outreach") {
    return (
      <div className="flex flex-col gap-2">
        <Row module="project" />
        <Row module="outreach" small />
      </div>
    );
  }
  return <Row module={module} />;
}

function Row({ module, small = false }: { module: keyof typeof MODULE_TABS; small?: boolean }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const isOn = (href: string, exact?: boolean) =>
    exact ? path === href : path === href || path.startsWith(href + "/") || (module === "project" && href === "/app/followup" && OUTREACH_PAGES.some((p) => path.startsWith(p)));
  if (small) {
    return (
      <nav className="seg max-w-full self-start overflow-x-auto" aria-label={t("ptab.outreach")}>
        {MODULE_TABS[module].map((it) => (
          <Link key={it.href} href={it.href} className={`whitespace-nowrap ${isOn(it.href, it.href === "/app/outreach" || it.href === "/app/followup") ? "seg-on" : ""}`}>
            {t(it.key)}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex items-end gap-1 overflow-x-auto border-b border-line" aria-label={t("nav.menu")}>
      {MODULE_TABS[module].map((it) => {
        const on = isOn(it.href, it.exact);
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
    </nav>
  );
}
