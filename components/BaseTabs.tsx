"use client";
// Вкладки Outreach на страницах без своего заголовка (посредники, шаблоны, авторы); на Інпут — вкладки Confero.
import { usePathname } from "next/navigation";
import ModuleTabs from "@/components/ModuleTabs";

export default function BaseTabs() {
  const path = usePathname() ?? "";
  if (path.startsWith("/app/input") || path.startsWith("/app/import")) return <ModuleTabs module="confero" />;
  const outreach = ["/app/intermediaries", "/app/writers", "/app/templates", "/app/inbox", "/app/followup", "/app/outreach", "/app/articles", "/app/campaigns"].some((p) => path.startsWith(p));
  return outreach ? <ModuleTabs module="outreach" /> : null;
}
