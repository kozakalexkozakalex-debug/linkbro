"use server";

// Nexo: данные для панели справа и добавление сайтов посредника вручную (по одному или списком)
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { loadPeople } from "@/lib/people";
import { parseDomainPrices, priceText } from "@/lib/nexo-parse";
import { getI18n } from "@/lib/i18n/server";
import type { PersonRow } from "./PeopleTable";
import type { IntermediaryRow } from "./IntermediariesTable";

export async function getNexoData(): Promise<{ people: PersonRow[]; sites: IntermediaryRow[] }> {
  const { supabase, team } = await getTeamContext();
  return loadPeople(supabase, team.id);
}

// Добавить/обновить сайты посредника. Строка без цены не стирает уже известную цену.
export async function addNexoBatch(handle: string, text: string, currency: string): Promise<{ ok: boolean; added: number; priced: number; bad: string[]; error?: string }> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const who = handle.trim().slice(0, 300);
  if (!who) return { ok: false, added: 0, priced: 0, bad: [], error: t("nexo.needWho") };
  const { items, bad } = parseDomainPrices(text.slice(0, 200_000), currency);
  if (!items.length) return { ok: false, added: 0, priced: 0, bad, error: t("nexo.noDomains") };
  if (items.length > 2000) return { ok: false, added: 0, priced: 0, bad, error: t("err.tooMany", { n: 2000 }) };
  const withPrice = items.filter((x) => x.price != null).map((x) => ({ team_id: team.id, domain: x.domain, intermediary: who, price: priceText(x) }));
  const noPrice = items.filter((x) => x.price == null).map((x) => ({ team_id: team.id, domain: x.domain, intermediary: who }));
  for (const part of [withPrice, noPrice]) {
    for (let i = 0; i < part.length; i += 500) {
      const { error } = await supabase.from("intermediaries").upsert(part.slice(i, i + 500), { onConflict: "team_id,domain" });
      if (error) return { ok: false, added: 0, priced: 0, bad, error: error.message };
    }
  }
  revalidatePath("/app/intermediaries");
  return { ok: true, added: items.length, priced: withPrice.length, bad };
}
