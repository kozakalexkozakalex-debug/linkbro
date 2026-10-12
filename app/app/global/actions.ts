"use server";

import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { chunk } from "@/lib/fetchAll";
import { toNumber } from "@/lib/csv";
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

// ---------- Импорт CSV в глобальную базу ----------
export type ImportRow = Partial<Record<"domain" | "price" | "dr" | "keywords" | "traffic" | "geo" | "topics" | "tf" | "cf", string>>;
export type ImportResult = { added: number; updated: number; duplicates: number; invalid: number; error?: string };

export async function importGlobal(
  rows: ImportRow[],
  opts: { prefix: string; updateExisting: boolean; mapped: string[] },
): Promise<ImportResult> {
  const { supabase, team } = await getTeamContext();
  if (rows.length > 5000) return { added: 0, updated: 0, duplicates: 0, invalid: 0, error: "За раз можна до 5000 рядків. Розділіть файл." };

  const metricKeys = (["dr", "keywords", "traffic", "tf", "cf"] as const).filter((k) => opts.mapped.includes(k));
  const textKeys = (["geo", "topics"] as const).filter((k) => opts.mapped.includes(k));
  const prefix = opts.prefix.trim();

  const parsed = new Map<string, Record<string, string | number | null>>();
  let invalid = 0;
  for (const r of rows) {
    const domain = normalizeDomain(r.domain ?? "");
    if (!domain) {
      invalid++;
      continue;
    }
    if (parsed.has(domain)) continue;
    const rec: Record<string, string | number | null> = {};
    for (const k of metricKeys) rec[k] = toNumber(r[k]);
    for (const k of textKeys) rec[k] = (r[k] ?? "").trim().slice(0, 200);
    if (opts.mapped.includes("price")) {
      const p = (r.price ?? "").trim();
      rec.price = p ? (prefix ? `${prefix} ${p}` : p).slice(0, 200) : "";
    }
    parsed.set(domain, rec);
  }

  const domains = [...parsed.keys()];
  const existing = new Set<string>();
  for (const part of chunk(domains, 200)) {
    const { data, error } = await supabase.from("global_donors").select("domain").eq("team_id", team.id).in("domain", part);
    if (error) return { added: 0, updated: 0, duplicates: 0, invalid, error: error.message };
    (data ?? []).forEach((r: { domain: string }) => existing.add(r.domain));
  }

  const { data: last } = await supabase
    .from("global_donors")
    .select("batch")
    .eq("team_id", team.id)
    .order("batch", { ascending: false })
    .limit(1);
  const batch = ((last?.[0] as { batch: number } | undefined)?.batch ?? 0) + 1;

  const fresh = domains.filter((d) => !existing.has(d));
  for (const part of chunk(fresh, 500)) {
    const { error } = await supabase
      .from("global_donors")
      .insert(part.map((domain) => ({ team_id: team.id, domain, batch, price: "", ...parsed.get(domain) })));
    if (error) return { added: 0, updated: 0, duplicates: 0, invalid, error: "Не вдалося зберегти: " + error.message };
  }

  let updated = 0;
  const old = domains.filter((d) => existing.has(d));
  if (opts.updateExisting && (metricKeys.length || textKeys.length)) {
    for (const part of chunk(old, 500)) {
      const payload = part.map((domain) => {
        const rec = parsed.get(domain) ?? {};
        const row: Record<string, string | number | null> = { team_id: team.id, domain };
        for (const k of [...metricKeys, ...textKeys]) row[k] = rec[k] ?? null;
        return row;
      });
      const { error } = await supabase.from("global_donors").upsert(payload, { onConflict: "team_id,domain" });
      if (error) return { added: fresh.length, updated, duplicates: 0, invalid, error: "Не вдалося оновити: " + error.message };
      updated += part.length;
    }
  }

  revalidatePath("/app/global");
  return { added: fresh.length, updated, duplicates: opts.updateExisting ? 0 : old.length, invalid };
}

// ---------- Пакетное сохранение из таблицы (вставка блоком, протягивание) ----------
export type BatchChange = { id: string; field: string; value: string };

function parseGlobal(field: string, raw: string): { ok: true; value: string | number | null } | { ok: false; error: string } {
  if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
    const n = toNumber(raw);
    if (raw.trim() !== "" && (n == null || n < 0)) return { ok: false, error: `«${raw}» — потрібне число` };
    return { ok: true, value: raw.trim() === "" ? null : n };
  }
  if ((TEXT_FIELDS as readonly string[]).includes(field)) return { ok: true, value: raw.trim().slice(0, 200) };
  return { ok: false, error: "це поле не редагується" };
}

export async function updateGlobalBatch(changes: BatchChange[]): Promise<{ ok: boolean; error?: string }> {
  if (changes.length > 10000) return { ok: false, error: "Забагато змін за раз (до 10 000)." };
  const { supabase, team } = await getTeamContext();
  const patches = new Map<string, Record<string, string | number | null>>();
  for (const c of changes) {
    const p = parseGlobal(c.field, c.value);
    if (!p.ok) return { ok: false, error: `${c.field}: ${p.error}` };
    patches.set(c.id, { ...(patches.get(c.id) ?? {}), [c.field]: p.value });
  }
  for (const part of chunk([...patches.entries()], 20)) {
    const res = await Promise.all(
      part.map(([id, patch]) => supabase.from("global_donors").update(patch).eq("id", id).eq("team_id", team.id)),
    );
    const bad = res.find((r) => r.error);
    if (bad?.error) return { ok: false, error: bad.error.message };
  }
  revalidatePath("/app/global");
  return { ok: true };
}
