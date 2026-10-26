"use client";

// Вкладки внутри модуля (Дашборд / разделы проекта / Outreach)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export const MODULE_TABS: Record<string, { href: string; key: MsgKey; sub?: MsgKey; exact?: boolean; also?: string[] }[]> = {
  dashboard: [
    { href: "/app", key: "ptab.overview", exact: true },
    { href: "/app/today", key: "nav.today" },
    { href: "/app/finance", key: "nav.money" },
    { href: "/app/tasks", key: "nav.tasks" },
  ],
  // Разделы проекта — одинаковый ряд на всех страницах проекта
  project: [
    { href: "/app/domains", key: "dom.prefero", sub: "dom.preferoSub" },
    { href: "/app/outreach", key: "ptab.outreach", sub: "mod.outreachSub" },
    { href: "/app/monitoring", key: "ptab.monitor", sub: "mod.monitorSub" },
    { href: "/app/settings", key: "mod.settingsShort", sub: "mod.settingsSub" },
  ],
  // Outreach — 4 розділи. Комунікація й Статті мають свої підвкладки (SUB нижче).
  outreach: [
    { href: "/app/outreach", key: "mod.deals" },
    { href: "/app/inbox", key: "ot.comms", also: ["/app/followup", "/app/templates"] },
    { href: "/app/intermediaries", key: "nav.contacts" },
    { href: "/app/articles", key: "art.tab", also: ["/app/writers"] },
  ],
  comms: [
    { href: "/app/inbox", key: "ot.inbox" },
    { href: "/app/followup", key: "ot.write" },
    { href: "/app/templates", key: "nav.templates" },
  ],
  articles: [
    { href: "/app/articles", key: "ot.board" },
    { href: "/app/writers", key: "nav.writers" },
  ],
};

const COMMS_PAGES = ["/app/inbox", "/app/followup", "/app/templates"];
const ARTICLE_PAGES = ["/app/articles", "/app/writers"];
const OUTREACH_PAGES = ["/app/outreach", "/app/followup", "/app/articles", "/app/campaigns", "/app/inbox", "/app/intermediaries", "/app/writers", "/app/templates"];

// Ряд вкладок модуля. У Outreach сверху ещё ряд разделов проекта (Prefero · Outreach · Моніторинг · Налаштування).
export default function ModuleTabs({ module }: { module: keyof typeof MODULE_TABS }) {
  if (module === "outreach") return <OutreachTabs />;
  return <Row module={module} />;
}

// Проєкт · розділ Outreach · (підвкладки Комунікації або Статей)
function OutreachTabs() {
  const path = usePathname() ?? "";
  const sub = COMMS_PAGES.some((p) => path.startsWith(p)) ? "comms" : ARTICLE_PAGES.some((p) => path.startsWith(p)) ? "articles" : null;
  return (
    <div className="flex flex-col gap-2">
      <Row module="project" />
      <Row module="outreach" small />
      {sub && <Row module={sub} sub />}
    </div>
  );
}

function Row({ module, small = false, sub = false }: { module: keyof typeof MODULE_TABS; small?: boolean; sub?: boolean }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const isOn = (href: string, exact?: boolean, also: string[] = []) =>
    exact
      ? path === href
      : path === href || path.startsWith(href + "/") || also.some((a) => path.startsWith(a)) || (module === "project" && href === "/app/outreach" && OUTREACH_PAGES.some((p) => path.startsWith(p)));
  if (sub) {
    return (
      <nav className="flex gap-3 border-b border-line text-sm" aria-label={t("nav.menu")}>
        {MODULE_TABS[module].map((it) => {
          const on = isOn(it.href, false, it.also);
          return (
            <Link key={it.href} href={it.href} className={`-mb-px border-b-2 px-1 pb-1.5 ${on ? "border-accent font-semibold text-ink" : "border-transparent text-mute hover:text-ink"}`} aria-current={on ? "page" : undefined}>
              {t(it.key)}
            </Link>
          );
        })}
      </nav>
    );
  }
  if (small) {
    return (
      <nav className="seg max-w-full self-start overflow-x-auto" aria-label={t("ptab.outreach")}>
        {MODULE_TABS[module].map((it) => (
          <Link key={it.href} href={it.href} className={`whitespace-nowrap ${isOn(it.href, it.href === "/app/outreach", it.also) ? "seg-on" : ""}`}>
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
