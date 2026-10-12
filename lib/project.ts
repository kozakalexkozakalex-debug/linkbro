// Типы, статусы и правила воронки проекта.
import { DEFAULT_FILTER, METRICS, type MetricFilter } from "@/lib/global";

// Стандартные статусы из ТЗ. Команда может добавить свои (таблица custom_statuses).
export const CORE_POS = ["OK_Cat", "In communication", "Price_ok", "client_OK", "Sent_article", "Paid", "Published"];
export const CORE_NEG = ["Low_metrics", "Bad_Cat", "Over_priced", "Poor_Article", "No_Index"];
export const COMM_STATUSES = ["Contacted", "In Discussion", "Accepted", "Declined", "No Response"];
export const COMM_BAD = ["Declined", "No Response"];
export const GP_STATUSES = ["Sent the article", "Need to correct", "Waiting for indexation", "Need to pay", "Paid"];

// Какие статусы Core открывают следующие модули
export const OPENS_COMM = "In communication";
export const OPENS_GP = ["Price_ok", "client_OK", "Sent_article", "Paid", "Published"];

export const INDICATORS = [
  { value: "sent", label: "відправив" },
  { value: "waiting", label: "очікування" },
  { value: "replied", label: "відповіли" },
] as const;
export type Indicator = (typeof INDICATORS)[number]["value"];

export type FgStatus = "new" | "core" | "out";

export type GlobalMetrics = {
  price: string;
  dr: number | null;
  keywords: number | null;
  traffic: number | null;
  geo: string;
  topics: string;
  tf: number | null;
  cf: number | null;
};

export type ProjectDonor = {
  id: string;
  domain: string;
  assignee: string | null;
  added_at: string;
  fg_status: FgStatus;
  core_status: string;
  published_at: string | null;
  category_page: string;
  in_comm: boolean;
  med_base: string;
  med_add: string;
  price_base: string;
  price_add: string;
  indicator: Indicator | null;
  indicator_at: string | null;
  comm_status: string;
  dialog: string;
  in_gp: boolean;
  gp_med: string;
  gp_price: number | null;
  payments: string;
  article_link: string;
  page_url: string;
  anchors: string;
  pre_anchor: string;
  article_url: string;
  gp_status: string;
  global_donors: GlobalMetrics | null;
};

export const DONOR_COLUMNS =
  "id, domain, assignee, added_at, fg_status, core_status, published_at, category_page, in_comm, med_base, med_add, price_base, price_add, indicator, indicator_at, comm_status, dialog, in_gp, gp_med, gp_price, payments, article_link, page_url, anchors, pre_anchor, article_url, gp_status, global_donors(price, dr, keywords, traffic, geo, topics, tf, cf)";

// Текстовые поля, которые можно править ячейкой
export const DONOR_TEXT_FIELDS = [
  "category_page",
  "med_add",
  "price_add",
  "dialog",
  "gp_med",
  "payments",
  "article_link",
  "page_url",
  "anchors",
  "pre_anchor",
  "article_url",
] as const;
export type DonorTextField = (typeof DONOR_TEXT_FIELDS)[number] | "gp_price";

export type Member = { id: string; name: string };

export type Project = {
  id: string;
  name: string;
  plan_per_month: number;
  requirements: string;
  notes: string;
  metric_filter: unknown;
};

export type CustomStatuses = { core_pos: string[]; core_neg: string[]; comm: string[] };

// Фильтр проекта из базы → всегда полный набор полей
export function normalizeFilter(raw: unknown): MetricFilter {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, { min?: unknown; max?: unknown } | undefined>;
  const out = { ...DEFAULT_FILTER };
  for (const m of METRICS) {
    const v = src[m.key];
    out[m.key] = {
      min: v?.min == null ? "" : String(v.min),
      max: v?.max == null ? "" : String(v.max),
    };
  }
  return out;
}

// Число из строки цены: "PRnews 1 500" → 1500, "138,78" → 138.78
export function priceNumber(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return s;
  const t = s.replace(/[^\d.,]/g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function ageLabel(hours: number): string {
  return hours < 24 ? `${Math.max(1, Math.round(hours))} год` : `${Math.round(hours / 24)} дн`;
}

export function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit" }).format(d);
  return fmt(new Date(iso)) === fmt(new Date());
}

export function monthYear(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
