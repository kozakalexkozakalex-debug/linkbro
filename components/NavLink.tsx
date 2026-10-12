"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Пункт меню, который подсвечивается, когда открыт его раздел
export default function NavLink({ href, exact, children, className = "" }: { href: string; exact?: boolean; children: React.ReactNode; className?: string }) {
  const path = usePathname() ?? "";
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={`side-link ${active ? "side-active" : ""} ${className}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
