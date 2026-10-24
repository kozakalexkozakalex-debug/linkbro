// Выбранный проект («Усі проєкти» или один). Хранится в cookie, модули показывают данные по нему.
import { cookies } from "next/headers";
import { getTeamContext } from "@/lib/team";

export const SCOPE_COOKIE = "lb_project";

export async function getScope(): Promise<{ projectId: string | null; projects: { id: string; name: string }[] }> {
  const { supabase, team } = await getTeamContext();
  const { data } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string }[];
  const saved = (await cookies()).get(SCOPE_COOKIE)?.value;
  const projectId = projects.some((p) => p.id === saved) ? (saved as string) : null;
  return { projectId, projects };
}
