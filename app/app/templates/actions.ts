"use server";

// Общие шаблоны команды: сообщения посредникам и ТЗ для авторов
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";

type Ok = { ok: true } | { ok: false; error: string };
export type Template = { id: string; kind: "message" | "brief"; name: string; body: string };

export async function saveTemplate(tpl: { id?: string; kind: string; name: string; body: string }): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const name = tpl.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: t("err.enterName") };
  if (tpl.kind !== "message" && tpl.kind !== "brief") return { ok: false, error: t("err.unknownType") };
  const row = { team_id: team.id, kind: tpl.kind, name, body: tpl.body.slice(0, 8000) };
  const { error } = tpl.id
    ? await supabase.from("templates").update(row).eq("id", tpl.id).eq("team_id", team.id)
    : await supabase.from("templates").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase.from("templates").delete().eq("id", id).eq("team_id", team.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/templates");
  return { ok: true };
}
