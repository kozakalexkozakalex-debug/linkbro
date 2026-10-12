"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEAM_COOKIE, getTeamContext, requireUser } from "@/lib/team";

const YEAR = 60 * 60 * 24 * 365;

async function rememberTeam(teamId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TEAM_COOKIE, teamId, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true, secure: true });
}

export async function createTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/onboarding?error=" + encodeURIComponent("Вкажіть назву команди."));

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_team", { p_name: name });
  if (error || !data) redirect("/onboarding?error=" + encodeURIComponent(error?.message ?? "Не вдалося створити команду."));

  await rememberTeam(String(data));
  redirect("/app");
}

export async function switchTeam(formData: FormData) {
  const teamId = String(formData.get("team_id") ?? "");
  if (teamId) await rememberTeam(teamId);
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !data) {
    redirect(`/invite/${encodeURIComponent(token)}?error=` + encodeURIComponent(error?.message ?? "Не вдалося приєднатися."));
  }
  await rememberTeam(String(data));
  redirect("/app");
}

export async function createInvite(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const role = formData.get("role") === "lead" ? "lead" : "builder";
  const { error } = await supabase.from("team_invites").insert({ team_id: team.id, role });
  if (error) redirect("/app/team?error=" + encodeURIComponent("Створювати запрошення може лише тімлід."));
  revalidatePath("/app/team");
  redirect("/app/team");
}

export async function deleteInvite(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  await supabase.from("team_invites").delete().eq("id", id).eq("team_id", team.id);
  revalidatePath("/app/team");
  redirect("/app/team");
}

export async function removeMember(formData: FormData) {
  const { supabase, user, team } = await getTeamContext();
  const userId = String(formData.get("user_id") ?? "");
  if (userId === user.id) redirect("/app/team?error=" + encodeURIComponent("Не можна видалити себе."));
  await supabase.from("team_members").delete().eq("team_id", team.id).eq("user_id", userId);
  revalidatePath("/app/team");
  redirect("/app/team");
}
