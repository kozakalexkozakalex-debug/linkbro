"use client";

// Телефон: нижнее меню с рабочими разделами. «Меню» выдвигает полное боковое меню (.side) слева.
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { toggleNav } from "@/components/TopBar";
import { useI18n } from "@/components/I18nProvider";
import { MOBILE_NAV, isActive } from "@/lib/nav";

export default function MobileNav() {
  const { t } = useI18n();
  const path = usePathname() ?? "";

  // Меню закрывается при переходе на другую страницу
  useEffect(() => {
    toggleNav(false);
    return () => toggleNav(false);
  }, [path]);

  return (
    <>
      <button type="button" className="m-backdrop" aria-label={t("common.close")} onClick={() => toggleNav(false)} />
      <nav className="m-bottom" aria-label={t("nav.menu")}>
        {MOBILE_NAV.map((it) => {
          const active = isActive(path, it);
          return (
            <Link key={it.href} href={it.href} className={`m-item ${active ? "m-on" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon name={it.icon} size={20} />
              <span>{t(it.key)}</span>
            </Link>
          );
        })}
        <button type="button" className="m-item" onClick={() => toggleNav()}>
          <Icon name="menu" size={20} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
    </>
  );
}
