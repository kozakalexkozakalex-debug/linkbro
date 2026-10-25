// Моніторинг: какие размещения отслеживаем и в каком они состоянии (общее для Огляду и Посилань)
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";

export const PROBLEM = ["missing", "nofollow", "noindex", "anchor", "target"];
export const TECH = ["error", "blocked"];
export type MonState = "ok" | "problem" | "suspect" | "tech" | "unchecked" | "nourl";

export function monState(d: Pick<ProjectDonor, "article_url" | "link_status">): MonState {
  if (!d.article_url?.trim()) return "nourl";
  if (d.link_status === "ok") return "ok";
  if (d.link_status === "suspect") return "suspect";
  if (PROBLEM.includes(d.link_status)) return "problem";
  if (TECH.includes(d.link_status)) return "tech";
  return "unchecked";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlacements(supabase: any, teamId: string, projectId: string | null): Promise<ProjectDonor[]> {
  return fetchAll<ProjectDonor>((from, to) => {
    let q = supabase.from("project_donors").select(DONOR_COLUMNS).eq("team_id", teamId).or("stage.eq.published,article_url.neq.");
    if (projectId) q = q.eq("project_id", projectId);
    return q.order("published_at", { ascending: false, nullsFirst: false }).range(from, to);
  });
}
