"use server";

// Проблеми моніторингу: змінити статус / відповідального / строк, коментар у стрічку угоди
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";

type Ok = { ok: true } | { ok: false; error: string };
const STATUSES = ["detected", "confirmed", "in_progress", "resolved", "false_positive"];

export async function updateIssue(id: string, patch: { status?: string; assignee?: string | null; due_date?: string | null; resolution?: string }): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const p: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) return { ok: false, error: t("err.unknownStatus") };
    p.status = patch.status;
    const now = new Date().toISOString();
    if (patch.status === "confirmed") p.confirmed_at = now;
    if (patch.status === "resolved" || patch.status === "false_positive") p.resolved_at = now;
  }
  if (patch.assignee !== undefined) {
    if (patch.assignee) {
      const { data: m } = await supabase.from("team_members").select("user_id").eq("team_id", team.id).eq("user_id", patch.assignee).maybeSingle();
      if (!m) return { ok: false, error: t("err.notInTeam") };
    }
    p.assignee = patch.assignee || null;
  }
  if (patch.due_date !== undefined) {
    if (patch.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.due_date)) return { ok: false, error: t("err.date") };
    p.due_date = patch.due_date || null;
  }
  if (patch.resolution !== undefined) p.resolution = patch.resolution.slice(0, 1000);
  const { data, error } = await supabase.from("link_issues").update(p).eq("id", id).eq("team_id", team.id).select("donor_id, status").maybeSingle();
  if (error) return { ok: false, error: error.message };
  // «Хибна тривога» вручную — ссылка считается на месте, подозрение снимаем
  if (patch.status === "false_positive" && data) {
    await supabase.from("project_donors").update({ link_status: "ok", link_suspect: "", link_problem_at: null }).eq("id", (data as { donor_id: string }).donor_id).eq("team_id", team.id);
  }
  revalidatePath("/app/monitoring/issues");
  return { ok: true };
}

// Коментар до проблеми — у стрічку угоди (там же, де вся переписка)
export async function commentIssue(issueId: string, text: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const body = text.trim().slice(0, 4000);
  if (!body) return { ok: false, error: t("out.errEmpty") };
  const { data: i } = await supabase.from("link_issues").select("donor_id, project_id").eq("id", issueId).eq("team_id", team.id).maybeSingle();
  const issue = i as { donor_id: string; project_id: string } | null;
  if (!issue) return { ok: false, error: t("err.donorNotFound") };
  const { data: d } = await supabase.from("project_donors").select("med_base").eq("id", issue.donor_id).eq("team_id", team.id).maybeSingle();
  const { error } = await supabase.from("activities").insert({
    team_id: team.id,
    project_id: issue.project_id,
    donor_id: issue.donor_id,
    handle: (d as { med_base: string } | null)?.med_base ?? "",
    channel: "note",
    direction: "out",
    body: `🛡 ${body}`,
    is_read: true,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
