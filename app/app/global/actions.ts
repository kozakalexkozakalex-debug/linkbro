"use server";

import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import {
  GLOBAL_COLUMNS,
  NUMERIC_FIELDS,
  TEXT_FIELDS,
  hasAllMetrics,
  normalizeDomain,
  passesFilter,
  type EditableField,
  type GlobalDonor,
  type MetricFilter,
} from "@/lib/global";

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ---------- Инпут: передать доноров в глобальную базу ----------
export type InputResult = { added: string[]; dup: string[]; invalid: string[]; error?: string } | null;

export async function addToGlobal(_prev: InputResult, formData: FormData): Promise<InputResult> {
  const raw = String(formData.get("raw") ?? "");
  const prefix = String(formData.get("prefix") ?? "").trim();
  const { supabase, team } = await getTeamContext();

  // Разбор строк: первое слово — домен, остальное — цена
  const parsed = new Map<string, string>();
  const invalid: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(\S+?)(?:[\s;,\t]+(.*))?$/);
    const domain = m ? normalizeDomain(m[1]) : null;
    if (!domain) {
      invalid.push(t);
      continue;
    }
    if (!parsed.has(domain)) parsed.set(domain, (m?.[2] ?? "").trim());
  }
  if (parsed.size === 0) return { added: [], dup: [], invalid, error: invalid.length ? undefined : "Вставте хоча б один домен." };

  // Какие уже есть в глобале (это и есть стоп-лист инпута)
  const domains = [...parsed.keys()];
  const existing = new Set<string>();
  for (const part of chunk(domains, 200)) {
    const { data, error } = await supabase.from("global_donors").select("domain").eq("team_id", team.id).in("domain", part);
    if (error) return { added: [], dup: [], invalid, error: "Не вдалося перевірити базу: " + error.message };
    (data ?? []).forEach((r: { domain: string }) => existing.add(r.domain));
  }

  const fresh = domains.filter((d) => !existing.has(d));
  const dup = domains.filter((d) => existing.has(d));
  if (fresh.length === 0) return { added: [], dup, invalid };

  // Номер итерации: следующий после последнего
  const { data: last } = await supabase
    .from("global_donors")
    .select("batch")
    .eq("team_id", team.id)
    .order("batch", { ascending: false })
    .limit(1);
  const batch = ((last?.[0] as { batch: number } | undefined)?.batch ?? 0) + 1;

  const rows = fresh.map((domain) => {
    const p = parsed.get(domain) ?? "";
    return { team_id: team.id, domain, batch, price: p ? (prefix ? `${prefix} ${p}` : p) : "" };
  });
  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from("global_donors").insert(part);
    if (error) return { added: [], dup, invalid, error: "Не вдалося зберегти: " + error.message };
  }

  revalidatePath("/app/global");
  return { added: fresh, dup, invalid };
}

// ---------- Правка одной ячейки в глобальной базе ----------
export type FieldResult = { ok: true; value: string | number | null } | { ok: false; error: string };

export async function updateGlobalField(id: string, field: EditableField, rawValue: string): Promise<FieldResult> {
  const { supabase, team } = await getTeamContext();
  let value: string | number | null;

  if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
    const t = rawValue.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") value = null;
    else {
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Потрібне число" };
      value = n;
    }
  } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    value = rawValue.trim().slice(0, 200);
  } else {
    return { ok: false, error: "Це поле не редагується" };
  }

  const { error } = await supabase.from("global_donors").update({ [field]: value }).eq("id", id).eq("team_id", team.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value };
}

// ---------- CHECK: NEW → FIT / DROP по фильтру метрик ----------
export type CheckResult = { fit: number; drop: number; skipped: number; error?: string };

export async function runCheck(filter: MetricFilter): Promise<CheckResult> {
  const { supabase, team } = await getTeamContext();

  // Забираем всю базу команды страницами по 1000
  const all: GlobalDonor[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("global_donors")
      .select(GLOBAL_COLUMNS)
      .eq("team_id", team.id)
      .order("id")
      .range(from, from + 999);
    if (error) return { fit: 0, drop: 0, skipped: 0, error: error.message };
    all.push(...((data ?? []) as unknown as GlobalDonor[]));
    if (!data || data.length < 1000) break;
  }

  const fitIds: string[] = [];
  const dropIds: string[] = [];
  let skipped = 0;
  for (const d of all) {
    if (!hasAllMetrics(d)) {
      skipped++;
      continue;
    }
    (passesFilter(d, filter) ? fitIds : dropIds).push(d.id);
  }

  const now = new Date().toISOString();
  for (const [status, ids] of [["fit", fitIds], ["drop", dropIds]] as const) {
    for (const part of chunk(ids, 300)) {
      const { error } = await supabase
        .from("global_donors")
        .update({ status, checked_at: now })
        .eq("team_id", team.id)
        .in("id", part);
      if (error) return { fit: 0, drop: 0, skipped, error: error.message };
    }
  }

  revalidatePath("/app/global");
  return { fit: fitIds.length, drop: dropIds.length, skipped };
}
