import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { loadMembers } from "@/lib/members";
import ModuleHead from "@/components/ModuleHead";
import IssuesTable, { type IssueRow } from "./IssuesTable";
import MonitorTabs from "@/components/MonitorTabs";

// Моніторинг → Проблеми: що зламано, з якого часу, наскільки важливо, хто вирішує і до коли
type Search = Promise<{ f?: string }>;
const OPEN = ["detected", "confirmed", "in_progress"];

export default async function IssuesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const f = sp.f === "closed" || sp.f === "all" ? sp.f : "open";
  const [{ supabase, team }, { t }, { projectId, projects }] = await Promise.all([getTeamContext(), getI18n(), getScope()]);
  let q = supabase
    .from("link_issues")
    .select("id, donor_id, project_id, type, severity, status, detected_at, confirmed_at, resolved_at, assignee, due_date, resolution, project_donors(domain, med_base, article_url, guarantee_until)")
    .eq("team_id", team.id)
    .order("detected_at", { ascending: false })
    .limit(500);
  if (projectId) q = q.eq("project_id", projectId);
  if (f === "open") q = q.in("status", OPEN);
  if (f === "closed") q = q.in("status", ["resolved", "false_positive"]);
  const [{ data }, members, { count: openN }] = await Promise.all([
    q,
    loadMembers(supabase, team.id),
    (() => {
      let c = supabase.from("link_issues").select("id", { count: "exact", head: true }).eq("team_id", team.id).in("status", OPEN);
      if (projectId) c = c.eq("project_id", projectId);
      return c;
    })(),
  ]);
  const pName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const rows = ((data ?? []) as unknown as (Omit<IssueRow, "domain" | "med" | "articleUrl" | "guarantee" | "project"> & { project_donors: { domain: string; med_base: string; article_url: string; guarantee_until: string | null } | { domain: string; med_base: string; article_url: string; guarantee_until: string | null }[] | null })[]).map((r) => {
    const d = Array.isArray(r.project_donors) ? r.project_donors[0] : r.project_donors;
    const { project_donors: _x, ...rest } = r;
    void _x;
    return { ...rest, domain: d?.domain ?? "—", med: d?.med_base ?? "", articleUrl: d?.article_url ?? "", guarantee: d?.guarantee_until ?? null, project: projectId ? "" : pName[r.project_id] ?? "" } as IssueRow;
  });
  // Сначала важные и подтверждённые
  const sev = { high: 0, medium: 1, low: 2 } as const;
  const st = { confirmed: 0, in_progress: 1, detected: 2, resolved: 3, false_positive: 4 } as const;
  rows.sort((a, b) => st[a.status] - st[b.status] || sev[a.severity] - sev[b.severity] || b.detected_at.localeCompare(a.detected_at));

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("ptab.monitor")} project={projectId ? pName[projectId] : t("dash.allProjects")} module="project" />
      <MonitorTabs on="issues" open={openN ?? 0} />
      <div className="seg self-start">
        {(["open", "closed", "all"] as const).map((k) => (
          <Link key={k} href={`/app/monitoring/issues${k === "open" ? "" : `?f=${k}`}`} className={f === k ? "seg-on" : ""}>
            {t(k === "open" ? "iss.fOpen" : k === "closed" ? "iss.fClosed" : "common.all")}
          </Link>
        ))}
      </div>
      <IssuesTable rows={rows} members={members} />
    </div>
  );
}

