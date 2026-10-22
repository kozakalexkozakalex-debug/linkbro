"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

// Телефон: верхняя полоска с логотипом и нижнее меню с главными разделами.
// Кнопка «Меню» выдвигает полное боковое меню (.side) слева.
const ICON: Record<string, React.ReactNode> = {
  dash: <path d="M4 13h6V4H4zm0 7h6v-5H4zm8 0h8v-9h-8zm0-16v5h8V4z" />,
  global: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m6.9 6h-3a15 15 0 0 0-1.3-4 8 8 0 0 1 4.3 4M12 4c.9 1.2 1.6 2.6 2 4h-4c.4-1.4 1.1-2.8 2-4M4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 4 8 8 0 0 1-4.3-4m3-8h-3a8 8 0 0 1 4.3-4 15 15 0 0 0-1.3 4M12 20c-.9-1.2-1.6-2.6-2-4h4c-.4 1.4-1.1 2.8-2 4m2.3-6H9.7a15 15 0 0 1 0-4h4.6a15 15 0 0 1 0 4m.3 5.9c.6-1.2 1-2.6 1.3-3.9h3a8 8 0 0 1-4.3 3.9m1.8-5.9a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4z" />,
  tasks: <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />,
  money: <path d="M11.8 10.9c-2.3-.6-3-1.2-3-2.1 0-1.1 1-1.9 2.7-1.9 1.8 0 2.4.8 2.5 2.1h2.2c-.1-1.7-1.1-3.3-3.2-3.8V3h-3v2.2c-1.9.4-3.5 1.7-3.5 3.6 0 2.3 1.9 3.5 4.7 4.1 2.5.6 3 1.5 3 2.4 0 .7-.5 1.8-2.7 1.8-2.1 0-2.9-.9-3-2.1H5.3c.1 2.2 1.8 3.5 3.7 3.9V21h3v-2.1c1.9-.4 3.5-1.5 3.5-3.6 0-2.9-2.5-3.9-4.7-4.4" />,
  folder: <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" />,
  plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />,
  today: <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V9h14zM7 11h5v5H7z" />,
  menu: <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      {ICON[name]}
    </svg>
  );
}

export default function MobileNav({ teamName }: { teamName: string }) {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // Меню закрывается при переходе на другую страницу
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-nav-open", open);
    return () => document.documentElement.removeAttribute("data-nav-open");
  }, [open]);

  const items = [
    { href: "/app/today", icon: "today", label: t("nav.today") },
    { href: "/app/projects", icon: "folder", label: t("common.projects") },
    { href: "/app/input", icon: "plus", label: t("nav.input") },
    { href: "/app/global", icon: "global", label: t("nav.global") },
    { href: "/app/tasks", icon: "tasks", label: t("nav.tasks") },
  ];

  return (
    <>
      <header className="m-top">
        <Link href="/app" className="font-display text-base font-bold">
          Link<span className="text-[#ff8a3d]">Bro</span>
        </Link>
        <span className="truncate text-sm opacity-80">{teamName}</span>
      </header>

      {open && <button type="button" className="m-backdrop" aria-label={t("common.close")} onClick={() => setOpen(false)} />}

      <nav className="m-bottom" aria-label={t("nav.menu")}>
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} className={`m-item ${active ? "m-on" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </Link>
          );
        })}
        <button type="button" className={`m-item ${open ? "m-on" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="menu" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
    </>
  );
}
