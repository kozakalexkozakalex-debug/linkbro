import { getTeamContext } from "@/lib/team";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import { loadPlacements } from "@/lib/monitoring";
import ModuleHead from "@/components/ModuleHead";
import MonitorTabs from "@/components/MonitorTabs";
import LinksTable from "./LinksTable";

export const maxDuration = 60; // массовая проверка

// Моніторинг → Посилання: реєстр усіх розміщень з фільтрами й масовою перевіркою (або дошка)
export default async function LinksPage({ searchParams }: { searchParams: Promise<{ f?: string; view?: string }> }) {
  const sp = await searchParams;
  const [{ projectId, projects }, { t }, { supabase, team }] = await Promise.all([getScope(), getI18n(), getTeamContext()]);
  let iq = supabase.from("link_issues").select("id", { count: "exact", head: true }).eq("team_id", team.id).in("status", ["confirmed", "in_progress"]);
  if (projectId) iq = iq.eq("project_id", projectId);
  const [rows, { count }] = await Promise.all([loadPlacements(supabase, team.id, projectId), iq]);
  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("ptab.monitor")} project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dash.allProjects")} module="project" />
      <MonitorTabs on="links" open={count ?? 0} />
      <LinksTable rows={rows} projects={projectId ? {} : Object.fromEntries(projects.map((p) => [p.id, p.name]))} initialFilter={sp.f ?? "all"} initialView={sp.view === "board" ? "board" : "table"} />
    </div>
  );
}
