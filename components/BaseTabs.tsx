"use client";
// Совместимость: вкладки модуля «Домени» или «Outreach» по текущему адресу
import { usePathname } from "next/navigation";
import ModuleTabs from "@/components/ModuleTabs";

export default function BaseTabs() {
  const path = usePathname() ?? "";
  const outreach = ["/app/intermediaries", "/app/writers", "/app/templates", "/app/inbox"].some((p) => path.startsWith(p));
  return <ModuleTabs module={outreach ? "outreach" : "domains"} />;
}
