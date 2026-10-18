// Участники команды с именами (для выбора ответственного и отчётов)
import type { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/project";

type Db = Awaited<ReturnType<typeof createClient>>;

export async function loadMembers(supabase: Db, teamId: string): Promise<Member[]> {
  const { data: m } = await supabase.from("team_members").select("user_id").eq("team_id", teamId).order("created_at");
  const ids = ((m ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: p } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
  const byId = new Map(((p ?? []) as { id: string; email: string | null; full_name: string | null }[]).map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = byId.get(id);
    return { id, name: r?.full_name || r?.email || "—" };
  });
}
