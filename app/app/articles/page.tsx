import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";
import ModuleHead from "@/components/ModuleHead";
import ArticlesBoard from "./ArticlesBoard";

// Outreach → Статті: дошка виробництва статей по погоджених угодах (вибраний проєкт або всі)
export default async function ArticlesPage() {
  const [{ supabase, team }, { t }, { projectId, projects }] = await Promise.all([getTeamContext(), getI18n(), getScope()]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(); // опубліковані цього місяця
  const rows = await fetchAll<ProjectDonor>((from, to) => {
    let q = supabase
      .from("project_donors")
      .select(DONOR_COLUMNS)
      .eq("team_id", team.id)
      .eq("fg_status", "core")
      .or(`stage.in.(agreed,writing,review,sent,paid),and(stage.eq.published,published_at.gte."${monthStart}")`);
    if (projectId) q = q.eq("project_id", projectId);
    return q.order("article_deadline", { ascending: true, nullsFirst: false }).range(from, to);
  });
  const pName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("art.tab")} project={projectId ? pName[projectId] : t("dash.allProjects")} module="outreach" />
      <p className="max-w-3xl text-sm text-mute">{t("art.lead")}</p>
      <ArticlesBoard rows={rows} projects={projectId ? {} : pName} />
    </div>
  );
}
