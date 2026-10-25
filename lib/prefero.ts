// Prefero: воронка проверки домена для проекта.
// 1) Метрики (DR, KW, Traffic, TF, CF, TF/CF) — автоматически, из Confero и фильтра проекта.
// 2) GEO — автоматически (сравнение с GEO проекта), можно поправить вручную.
// 3) Тема — вручную. 4) Category page — «ок», если вписана, или вручную.
// Итог: всё ✓ → Підходить; есть ✕ → Не підходить (причина — первый ✕ этап); есть ? → Перевірити.
import { METRICS, geoMatches, type MetricFilter, type MetricKey } from "@/lib/global";

export type Mark = "ok" | "no" | "?";
export type CheckKey = "geo" | "topic" | "category";
export const CHECK_KEYS: CheckKey[] = ["geo", "topic", "category"];
export type Checks = Partial<Record<CheckKey, "ok" | "no">>;

type G = { dr: number | null; keywords: number | null; traffic: number | null; tf: number | null; cf: number | null; geo: string; topics: string } | null | undefined;
type D = { fg_status: string; category_page: string; checks?: Checks | null; global_donors?: G };

function num(s: string): number | null {
  const t = (s ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function metricValue(g: G, key: MetricKey): number | null {
  if (!g) return null;
  if (key === "ratio") return g.tf != null && g.cf ? Math.round((g.tf / g.cf) * 100) / 100 : null;
  return g[key];
}

export type MetricLine = { key: MetricKey; label: string; value: number | null; min: number | null; max: number | null; mark: Mark };

// Метрики против фильтра проекта. ✕ здесь = фильтр поменяли уже после попадания домена в проект.
export function metricLines(g: G, f: MetricFilter): MetricLine[] {
  return METRICS.map((m) => {
    const value = metricValue(g, m.key);
    const min = num(f[m.key]?.min ?? "");
    const max = num(f[m.key]?.max ?? "");
    const mark: Mark = value == null ? "?" : (min == null || value >= min) && (max == null || value <= max) ? "ok" : "no";
    return { key: m.key, label: m.label, value, min, max, mark };
  });
}

export function checkMark(d: D, key: CheckKey, projectGeo: string): Mark {
  const set = d.checks?.[key];
  if (set) return set;
  if (key === "geo") {
    const g = geoMatches(projectGeo, d.global_donors?.geo);
    return g == null ? "?" : g ? "ok" : "no";
  }
  if (key === "category") return d.category_page.trim() ? "ok" : "?";
  return "?";
}

export type Verdict = { status: "work" | "fit" | "check" | "out"; failed: string | null; pending: CheckKey[]; metricsBad: MetricKey[] };

export function verdict(d: D, f: MetricFilter, projectGeo: string): Verdict {
  const metricsBad = metricLines(d.global_donors, f).filter((l) => l.mark === "no").map((l) => l.key);
  const marks = CHECK_KEYS.map((k) => [k, checkMark(d, k, projectGeo)] as const);
  const firstNo = marks.find(([, m]) => m === "no")?.[0] ?? null;
  const pending = marks.filter(([, m]) => m === "?").map(([k]) => k);
  if (d.fg_status === "core") return { status: "work", failed: null, pending, metricsBad };
  if (firstNo) return { status: "out", failed: firstNo, pending, metricsBad };
  if (d.fg_status === "out") return { status: "out", failed: "manual", pending, metricsBad };
  if (pending.length) return { status: "check", failed: null, pending, metricsBad };
  return { status: "fit", failed: null, pending, metricsBad };
}

// Какое fg_status / reject_reason хранить в базе по итогам чекпоинтов (кроме «в работе»)
export function fgFor(v: Verdict): { fg_status: string; reject_reason?: string } {
  if (v.status === "out" && v.failed && v.failed !== "manual") return { fg_status: "out", reject_reason: v.failed };
  if (v.status === "fit") return { fg_status: "ok", reject_reason: "" };
  if (v.status === "check") return { fg_status: "new", reject_reason: "" };
  return { fg_status: v.status === "work" ? "core" : "out" };
}
