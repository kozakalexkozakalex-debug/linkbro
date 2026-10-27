"use client";

// Вкладки внутри раздела. Один ряд вкладок; у Комунікації и Статей — маленький переключатель подразделов.
// Разделы проекта (Prefero · Outreach · Моніторинг · Налаштування) теперь только в боковом меню — здесь не дублируются.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

type Tab = { href: string; key: MsgKey; exact?: boolean; also?: string[] };

export const MODULE_TABS: Record<string, Tab[]> = {
  dashboard: [
    { href: "/app", key: "ptab.overview", exact: true },
    { href: "/app/today", key: "nav.today" },
    { href: "/app/finance", key: "nav.money" },
    { href: "/app/tasks", key: "nav.tasks" },
  ],
  confero: [
    { href: "/app/global", key: "dom.confero" },
    { href: "/app/input", key: "dom.infero", also: ["/app/import"] },
  ],
  // Сохранено ради совместимости вызовов: ряд разделов проекта больше не рисуется
  project: [],
  outreach: [
    { href: "/app/outreach", key: "mod.deals", exact: true },
    { href: "/app/inbox", key: "ot.comms", also: ["/app/followup", "/app/campaigns", "/app/templates"] },
    { href: "/app/intermediaries", key: "nav.contacts" },
    { href: "/app/articles", key: "art.tab", also: ["/app/writers"] },
  ],
  comms: [
    { href: "/app/inbox", key: "ot.inbox" },
    { href: "/app/followup", key: "ot.write" },
    { href: "/app/campaigns", key: "seq.tab" },
    { href: "/app/templates", key: "nav.templates" },
  ],
  articles: [
    { href: "/app/articles", key: "ot.board" },
    { href: "/app/writers", key: "nav.writers" },
  ],
};

const SUB: Record<string, string[]> = {
  comms: ["/app/inbox", "/app/followup", "/app/campaigns", "/app/templates"],
  articles: ["/app/articles", "/app/writers"],
};

export default function ModuleTabs({ module }: { module: keyof typeof MODULE_TABS }) {
  const path = usePathname() ?? "";
  if (!MODULE_TABS[module]?.length) return null;
  const sub = module === "outreach" ? Object.keys(SUB).find((k) => SUB[k].some((p) => path.startsWith(p))) : undefined;
  return (
    <div className="flex flex-col gap-3">
      <Row tabs={MODULE_TABS[module]} />
      {sub && <Row tabs={MODULE_TABS[sub]} small />}
    </div>
  );
}

function Row({ tabs, small = false }: { tabs: Tab[]; small?: boolean }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const isOn = (it: Tab) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/")) || (it.also ?? []).some((a) => path.startsWith(a));
  if (small) {
    return (
      <nav className="seg max-w-full self-start overflow-x-auto" aria-label={t("nav.where")}>
        {tabs.map((it) => {
          const on = isOn(it);
          return (
            <Link key={it.href} href={it.href} className={`whitespace-nowrap ${on ? "seg-on" : ""}`} aria-current={on ? "page" : undefined}>
              {t(it.key)}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="tabs" aria-label={t("nav.where")}>
      {tabs.map((it) => {
        const on = isOn(it);
        return (
          <Link key={it.href} href={it.href} className={`tab ${on ? "tab-on" : ""}`} aria-current={on ? "page" : undefined}>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
