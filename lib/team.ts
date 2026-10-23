// Кто вошёл и в какой команде он сейчас работает.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const TEAM_COOKIE = "lb_team";

export type Role = "lead" | "builder";
export type TeamRef = { id: string; name: string; role: Role };

// cache(): в пределах одного открытия страницы проверка входа и список команд
// запрашиваются один раз, даже если их зовут и меню, и сама страница.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

type MembershipRow = {
  team_id: string;
  role: Role;
  teams: { name: string } | { name: string }[] | null;
};

export const listMyTeams = cache(async (): Promise<TeamRef[]> => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("team_members")
    .select("team_id, role, teams(name)")
    .eq("user_id", user.id)
    .order("created_at");

  return ((data ?? []) as MembershipRow[]).map((m) => {
    const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return { id: m.team_id, name: t?.name ?? "Team", role: m.role };
  });
});

// Текущая команда: из cookie, если пользователь в ней состоит, иначе первая по списку.
export const getTeamContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const teams = await listMyTeams();
  if (teams.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const saved = cookieStore.get(TEAM_COOKIE)?.value;
  const team = teams.find((t) => t.id === saved) ?? teams[0];

  return { supabase, user, teams, team };
});

// Безопасный адрес для перехода после входа: только внутренние пути.
export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
