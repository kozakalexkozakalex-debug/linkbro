import { getTeamContext } from "@/lib/team";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";
import ModuleHead from "@/components/ModuleHead";
import ProjectView, { type SearchValues } from "../projects/[id]/ProjectView";
import BoardHost from "../projects/[id]/BoardHost";
import MonitorTabs from "@/components/MonitorTabs";

export const maxDuration = 60; // массовая проверка ссылок / рассылка — до минуты

// Моніторинг: опубликованные ссылки выбранного проекта или всех проектов сразу
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }, { supabase, team }] = await Promise.all([getScope(), getI18n(), getTeamContext()]);
  let issues = supabase.from("link_issues").select("id", { count: "exact", head: true }).eq("team_id", team.id).in("status", ["detected", "confirmed", "in_progress"]);
  if (projectId) issues = issues.eq("project_id", projectId);
  const [rows, { count: openIssues }] = await Promise.all([
    projectId
      ? Promise.resolve([] as ProjectDonor[])
      : fetchAll<ProjectDonor>((from, to) =>
          supabase.from("project_donors").select(DONOR_COLUMNS).eq("team_id", team.id).or("stage.eq.published,article_url.neq.").order("published_at", { ascending: false }).range(from, to),
        ),
    issues,
  ]);
  return (
    <div className="flex flex-col gap-5">
      <ModuleHead title={t("ptab.monitor")} project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dash.allProjects")} module="project" />
      <MonitorTabs on="links" open={openIssues ?? 0} />
      {projectId ? (
        <ProjectView id={projectId} sp={{ ...sp, tab: "monitor" }} base="/app/monitoring" embed />
      ) : (
        <BoardHost kind="monitor" projectId="" rows={rows} />
      )}
    </div>
  );
}
