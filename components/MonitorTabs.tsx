// Вкладки Моніторингу: Огляд · Посилання · Проблеми (с числом открытых)
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function MonitorTabs({ on, open }: { on: "overview" | "links" | "issues"; open: number }) {
  const { t } = await getI18n();
  return (
    <nav className="flex gap-1 border-b border-line" aria-label={t("iss.title")}>
      <Link href="/app/monitoring" className={`tab ${on === "overview" ? "tab-on" : ""}`}>{t("ptab.overview")}</Link>
      <Link href="/app/monitoring/links" className={`tab ${on === "links" ? "tab-on" : ""}`}>{t("iss.links")}</Link>
      <Link href="/app/monitoring/issues" className={`tab ${on === "issues" ? "tab-on" : ""}`}>
        {t("iss.title")} {open > 0 && <span className="pill pill-bad ml-1">{open}</span>}
      </Link>
    </nav>
  );
}
