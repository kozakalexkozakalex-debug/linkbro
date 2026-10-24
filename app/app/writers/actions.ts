"use server";

// База авторов (копирайтеров)
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { CURRENCIES } from "@/lib/money";

type Ok = { ok: true } | { ok: false; error: string };
const FIELDS = ["name", "contact", "rate", "rate_unit", "currency", "languages", "niches", "notes"] as const;

export async function addWriter(formData: FormData): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: t("err.enterName") };
  const rateRaw = String(formData.get("rate") ?? "").replace(/\s/g, "").replace(",", ".");
  const rate = rateRaw ? Number(rateRaw) : null;
  if (rate != null && (!Number.isFinite(rate) || rate < 0)) return { ok: false, error: t("err.needNumber") };
  const currency = String(formData.get("currency") ?? "USD");
  const { error } = await supabase.from("writers").insert({
    team_id: team.id,
    name,
    contact: String(formData.get("contact") ?? "").trim().slice(0, 300),
    rate,
    rate_unit: ["article", "1000chars", "1000words"].includes(String(formData.get("rate_unit"))) ? String(formData.get("rate_unit")) : "article",
    currency: (CURRENCIES as readonly string[]).includes(currency) ? currency : "USD",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/writers");
  return { ok: true };
}

export async function updateWritersBatch(changes: { id: string; field: string; value: string }[]): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const patches = new Map<string, Record<string, unknown>>();
  for (const c of changes) {
    if (!(FIELDS as readonly string[]).includes(c.field)) return { ok: false, error: t("err.fieldNotEditable", { f: c.field }) };
    let v: unknown = c.value.trim();
    if (c.field === "rate") {
      const s = String(v).replace(/\s/g, "").replace(",", ".");
      v = s === "" ? null : Number(s);
      if (v != null && (!Number.isFinite(v as number) || (v as number) < 0)) return { ok: false, error: t("err.cellNumber", { v: c.value }) };
    }
    if (c.field === "currency" && !(CURRENCIES as readonly string[]).includes(String(v))) return { ok: false, error: t("err.unknownCurrency") };
    if (c.field === "rate_unit" && !["article", "1000chars", "1000words"].includes(String(v))) return { ok: false, error: t("err.unknownValue") };
    if (c.field === "name" && !v) return { ok: false, error: t("err.enterName") };
    patches.set(c.id, { ...(patches.get(c.id) ?? {}), [c.field]: typeof v === "string" ? v.slice(0, 2000) : v });
  }
  for (const [id, patch] of patches) {
    const { error } = await supabase.from("writers").update(patch).eq("id", id).eq("team_id", team.id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
