"use client";

// «База»: один раздел с переключателем вместо четырёх отдельных пунктов меню
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

const ITEMS: { href: string; key: MsgKey }[] = [
  { href: "/app/global", key: "nav.sites" },
  { href: "/app/intermediaries", key: "nav.contacts" },
  { href: "/app/writers", key: "nav.writers" },
  { href: "/app/input", key: "nav.add" },
  { href: "/app/import", key: "nav.import" },
];

export default function BaseTabs() {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  return (
    <nav className="seg max-w-full self-start overflow-x-auto" aria-label={t("nav.base")}>
      {ITEMS.map((it) => {
        const on = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={`whitespace-nowrap px-3 py-1.5 text-sm ${on ? "seg-on" : ""}`} aria-current={on ? "page" : undefined}>
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
