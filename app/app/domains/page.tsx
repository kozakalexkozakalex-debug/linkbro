import { redirect } from "next/navigation";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import ModuleHead from "@/components/ModuleHead";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";

// Домени: пул выбранного проекта. Без проекта — глобальная база.
export default async function DomainsPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }] = await Promise.all([getScope(), getI18n()]);
  if (!projectId) redirect("/app/global");
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title={t("ptab.pool")} project={projects.find((p) => p.id === projectId)?.name} module="domains" />
      <ProjectView id={projectId} sp={{ ...sp, tab: "pool" }} base="/app/domains" embed />
    </div>
  );
}
