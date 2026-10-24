import { getTeamContext } from "@/lib/team";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";
import ModuleHead from "@/components/ModuleHead";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";
import BoardHost from "../projects/[id]/BoardHost";

export const maxDuration = 60; // массовая проверка ссылок / рассылка — до минуты

// Моніторинг: опубликованные ссылки выбранного проекта или всех проектов сразу
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }, { supabase, team }] = await Promise.all([getScope(), getI18n(), getTeamContext()]);
  let rows: ProjectDonor[] = [];
  if (!projectId) {
    rows = await fetchAll<ProjectDonor>((from, to) =>
      supabase.from("project_donors").select(DONOR_COLUMNS).eq("team_id", team.id).or("stage.eq.published,article_url.neq.").order("published_at", { ascending: false }).range(from, to),
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title={t("ptab.monitor")} project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dash.allProjects")} module="project" />
      {projectId ? (
        <ProjectView id={projectId} sp={{ ...sp, tab: "monitor" }} base="/app/monitoring" embed />
      ) : (
        <BoardHost kind="monitor" projectId="" rows={rows} />
      )}
    </div>
  );
}
