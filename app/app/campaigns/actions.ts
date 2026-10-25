"use server";

// Кампании Outreach: создать, изменить, удалить, добавить/убрать сделки
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { CURRENCIES } from "@/lib/money";

type Ok = { ok: true } | { ok: false; error: string };

function parse(formData: FormData) {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(/\s/g, "").replace(",", ".");
    const n = v === "" ? null : Number(v);
    return n != null && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const cur = String(formData.get("currency") ?? "USD");
  const status = String(formData.get("status") ?? "active");
  const ends = String(formData.get("ends_on") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 120),
    goal: Math.max(0, Math.round(num("goal") ?? 0)),
    budget: num("budget"),
    currency: (CURRENCIES as readonly string[]).includes(cur) ? cur : "USD",
    template: String(formData.get("template") ?? "").slice(0, 8000),
    status: ["active", "paused", "done"].includes(status) ? status : "active",
    ends_on: /^\d{4}-\d{2}-\d{2}$/.test(ends) ? ends : null,
  };
}

export async function createCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const { projectId } = await getScope();
  const v = parse(formData);
  if (!projectId) redirect(`/app/campaigns?error=${encodeURIComponent(t("cmp.needProject"))}`);
  if (!v.name) redirect(`/app/campaigns?error=${encodeURIComponent(t("cmp.needName"))}`);
  const { data, error } = await supabase.from("campaigns").insert({ ...v, team_id: team.id, project_id: projectId }).select("id").single();
  if (error || !data) redirect(`/app/campaigns?error=${encodeURIComponent(error?.message ?? "error")}`);
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${(data as { id: string }).id}`);
}

export async function updateCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  const v = parse(formData);
  const { error } = await supabase.from("campaigns").update(v.name ? v : { ...v, name: undefined }).eq("id", id).eq("team_id", team.id);
  revalidatePath(`/app/campaigns/${id}`);
  redirect(`/app/campaigns/${id}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

export async function deleteCampaign(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  await supabase.from("campaigns").delete().eq("id", id).eq("team_id", team.id);
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}

// Добавить сделки в кампанию (или убрать — campaignId = null). Только сделки того же проекта.
export async function setDealsCampaign(donorIds: string[], campaignId: string | null): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const ids = donorIds.slice(0, 1000);
  if (!ids.length) return { ok: true };
  if (campaignId) {
    const { data: c } = await supabase.from("campaigns").select("id, project_id").eq("id", campaignId).eq("team_id", team.id).maybeSingle();
    if (!c) return { ok: false, error: t("err.unknownValue") };
    const { error } = await supabase.from("project_donors").update({ campaign_id: campaignId }).eq("team_id", team.id).eq("project_id", (c as { project_id: string }).project_id).in("id", ids);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/campaigns/${campaignId}`);
  } else {
    const { error } = await supabase.from("project_donors").update({ campaign_id: null }).eq("team_id", team.id).in("id", ids);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/app/campaigns");
  return { ok: true };
}
