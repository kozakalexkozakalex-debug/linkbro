"use server";

import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";

export async function createTask(formData: FormData) {
  const { supabase, team, user } = await getTeamContext();
  const text = String(formData.get("text") ?? "").trim().slice(0, 1000);
  if (!text) return;
  const projectId = String(formData.get("project_id") ?? "") || null;
  const assignee = String(formData.get("assignee") ?? "") || user.id;
  await supabase.from("tasks").insert({ team_id: team.id, project_id: projectId, assignee, text });
  revalidatePath("/app/tasks");
}

const NEXT: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };

export async function cycleTask(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "todo");
  await supabase.from("tasks").update({ status: NEXT[status] ?? "todo" }).eq("id", id).eq("team_id", team.id);
  revalidatePath("/app/tasks");
}

export async function deleteTask(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  await supabase.from("tasks").delete().eq("id", String(formData.get("id") ?? "")).eq("team_id", team.id);
  revalidatePath("/app/tasks");
}
