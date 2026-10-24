import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import ModuleHead from "@/components/ModuleHead";
import PickProject from "@/components/PickProject";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";

// Prefero: домены, которые подходят выбранному проекту по всем условиям (метрики + GEO + тема)
export default async function DomainsPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }] = await Promise.all([getScope(), getI18n()]);
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title="Prefero" project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dom.preferoSub")} module="project" />
      {projectId ? (
        <ProjectView id={projectId} sp={{ ...sp, tab: "pool" }} base="/app/domains" embed />
      ) : (
        <PickProject projects={projects} next="/app/domains" text={t("dom.pickProject")} />
      )}
    </div>
  );
}
