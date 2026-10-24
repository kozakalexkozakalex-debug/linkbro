"use client";
// Совместимость: на страницах Outreach — вкладки проекта + Outreach. На Confero / Infero вкладок нет.
import { usePathname } from "next/navigation";
import ModuleTabs from "@/components/ModuleTabs";

export default function BaseTabs() {
  const path = usePathname() ?? "";
  const outreach = ["/app/intermediaries", "/app/writers", "/app/templates", "/app/inbox", "/app/followup", "/app/outreach"].some((p) => path.startsWith(p));
  return outreach ? <ModuleTabs module="outreach" /> : null;
}
