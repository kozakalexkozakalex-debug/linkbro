// Общие типы и правила для глобальной базы доноров.

export type DonorStatus = "new" | "fit" | "drop";

export type GlobalDonor = {
  id: string;
  domain: string;
  price: string;
  batch: number;
  dr: number | null;
  keywords: number | null;
  traffic: number | null;
  geo: string;
  topics: string;
  tf: number | null;
  cf: number | null;
  status: DonorStatus;
  checked_at: string | null;
  added_at: string;
};

export const GLOBAL_COLUMNS =
  "id, domain, price, batch, dr, keywords, traffic, geo, topics, tf, cf, status, checked_at, added_at";

// Метрики, по которым работает фильтр (GEO и Topics не участвуют).
export const METRICS = [
  { key: "dr", label: "DR" },
  { key: "keywords", label: "Keywords" },
  { key: "traffic", label: "Traffic" },
  { key: "tf", label: "TF" },
  { key: "cf", label: "CF" },
  { key: "ratio", label: "TF/CF" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];
export type MetricFilter = Record<MetricKey, { min: string; max: string }>;

export const DEFAULT_FILTER: MetricFilter = {
  dr: { min: "20", max: "" },
  keywords: { min: "100", max: "" },
  traffic: { min: "500", max: "" },
  tf: { min: "10", max: "" },
  cf: { min: "10", max: "" },
  ratio: { min: "0.5", max: "" },
};

// Поля, которые можно править прямо в таблице
export const NUMERIC_FIELDS = ["dr", "keywords", "traffic", "tf", "cf"] as const;
export const TEXT_FIELDS = ["price", "geo", "topics"] as const;
export type EditableField = (typeof NUMERIC_FIELDS)[number] | (typeof TEXT_FIELDS)[number];

export function ratioOf(d: Pick<GlobalDonor, "tf" | "cf">): number | null {
  if (d.tf == null || d.cf == null || d.cf === 0) return null;
  return d.tf / d.cf;
}

function metricValue(d: GlobalDonor, key: MetricKey): number | null {
  return key === "ratio" ? ratioOf(d) : d[key];
}

// Все метрики заполнены? Иначе донор остаётся NEW.
export function hasAllMetrics(d: GlobalDonor): boolean {
  return METRICS.every((m) => metricValue(d, m.key) != null);
}

function toNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function passesFilter(d: GlobalDonor, f: MetricFilter): boolean {
  return METRICS.every((m) => {
    const v = metricValue(d, m.key);
    if (v == null) return false;
    const min = toNum(f[m.key]?.min ?? "");
    const max = toNum(f[m.key]?.max ?? "");
    return (min == null || v >= min) && (max == null || v <= max);
  });
}

// Приводим любой ввод к одному виду, чтобы дубли находились:
// "HTTPS://WWW.Site.com/page?x=1" → "site.com", "http://site.com:8080/" → "site.com",
// "сайт.укр" → "xn--80aswg.xn--j1amh" (так браузеры хранят кириллические домены).
export function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = "http://" + s;
  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\d*\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || host.length > 253) return null;
  return host;
}

const KYIV = "Europe/Kyiv";
export function fmtDateTime(iso: string, intl = "uk-UA"): string {
  return new Intl.DateTimeFormat(intl, {
    timeZone: KYIV, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
export function fmtDate(iso: string, intl = "uk-UA"): string {
  return new Intl.DateTimeFormat(intl, { timeZone: KYIV, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
