import Link from "next/link";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import ModuleHead from "@/components/ModuleHead";
import PickProject from "@/components/PickProject";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";

// Налаштування проєкту: профіль, метрики входу (фільтр), стоп-листи, звіт для клієнта + історія змін.
// Вкладки проєкту зверху — можна одразу перейти в Prefero / Outreach / Моніторинг.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }] = await Promise.all([getScope(), getI18n()]);
  const history = sp.tab === "history";
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title={t("mod.projectSettings")} project={projectId ? projects.find((p) => p.id === projectId)?.name : null} module="project" />
      {projectId ? (
        <>
          <div className="seg self-start">
            <Link href="/app/settings" className={history ? "" : "seg-on"}>{t("mod.settingsMain")}</Link>
            <Link href="/app/settings?tab=history" className={history ? "seg-on" : ""}>{t("proj.tabHistory")}</Link>
          </div>
          <ProjectView id={projectId} sp={{ ...sp, tab: history ? "history" : "profile" }} base="/app/settings" embed />
        </>
      ) : (
        <PickProject projects={projects} next="/app/settings" text={t("mod.pickForSettings")} />
      )}
    </div>
  );
}
