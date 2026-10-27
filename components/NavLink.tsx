"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";

// Пункт меню, который подсвечивается, когда открыт его раздел (или один из разделов also)
export default function NavLink({ href, exact, also = [], children, className = "" }: { href: string; exact?: boolean; also?: string[]; children: React.ReactNode; className?: string }) {
  const path = usePathname() ?? "";
  const active = isActive(path, { href, exact, also });
  return (
    <Link href={href} className={`side-link ${active ? "side-active" : ""} ${className}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
