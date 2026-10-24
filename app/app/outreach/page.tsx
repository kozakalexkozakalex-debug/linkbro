import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import ModuleHead from "@/components/ModuleHead";
import PickProject from "@/components/PickProject";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";

export const maxDuration = 60; // массовая проверка ссылок / рассылка — до минуты

// Outreach: доска сделок выбранного проекта (переговоры → статья → публикация)
export default async function OutreachPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }] = await Promise.all([getScope(), getI18n()]);
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title="Outreach" project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dash.allProjects")} module="outreach" />
      {projectId ? (
        <ProjectView id={projectId} sp={{ ...sp, tab: "work" }} base="/app/outreach" embed />
      ) : (
        <PickProject projects={projects} next="/app/outreach" text={t("mod.pickProject")} />
      )}
    </div>
  );
}
