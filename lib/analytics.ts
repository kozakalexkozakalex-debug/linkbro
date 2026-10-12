// Месяцы по Киеву и расчёт показателей для дашборда.
import { payState, realCost, addTo, type ByCurrency, type Currency } from "@/lib/money";

const TZ = "Europe/Kyiv";

export function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return y && m ? `${y}-${m}` : null;
}

export function currentMonth(): string {
  return monthKey(new Date().toISOString()) as string;
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, style: "long" | "short" = "long"): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 15));
  return new Intl.DateTimeFormat("uk-UA", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" }).format(d);
}

export function isValidMonth(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export type AnRow = {
  id: string;
  project_id: string;
  domain: string;
  assignee: string | null;
  added_at: string;
  fg_status: string;
  core_status: string;
  published_at: string | null;
  in_comm: boolean;
  in_gp: boolean;
  comm_status: string;
  gp_status: string;
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  paid_at: string | null;
  indicator: string | null;
  indicator_at: string | null;
  link_status: string;
  guarantee_until: string | null;
};

export const AN_COLUMNS =
  "id, project_id, domain, assignee, added_at, fg_status, core_status, published_at, in_comm, in_gp, comm_status, gp_status, gp_price, gp_currency, gp_commission, pay_status, paid_at, indicator, indicator_at, link_status, guarantee_until";

export type MonthStats = {
  published: number;
  spend: ByCurrency;
  paidCount: Partial<Record<Currency, number>>;
  days: number[]; // дней от начала переписки до публикации
};

// commStart: donor_id → когда донор перешёл в «In communication» (из истории)
export function monthStats(rows: AnRow[], month: string, commStart: Map<string, string>): MonthStats {
  const s: MonthStats = { published: 0, spend: {}, paidCount: {}, days: [] };
  for (const r of rows) {
    if (r.core_status === "Published" && monthKey(r.published_at) === month) {
      s.published++;
      const start = commStart.get(r.id) ?? r.added_at;
      const d = (new Date(r.published_at as string).getTime() - new Date(start).getTime()) / 86_400_000;
      if (d >= 0) s.days.push(d);
    }
    if (payState(r) === "paid" && monthKey(r.paid_at) === month) {
      addTo(s.spend, r.gp_currency, realCost(r));
      const c = (["USD", "EUR", "UAH"].includes(r.gp_currency) ? r.gp_currency : "USD") as Currency;
      s.paidCount[c] = (s.paidCount[c] ?? 0) + 1;
    }
  }
  return s;
}

export function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function delta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function rate(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

export function mainCurrency(rows: AnRow[], prefer?: string): Currency {
  if (prefer && ["USD", "EUR", "UAH"].includes(prefer)) return prefer as Currency;
  const n: Record<string, number> = {};
  for (const r of rows) if (r.in_gp) n[r.gp_currency] = (n[r.gp_currency] ?? 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (best && ["USD", "EUR", "UAH"].includes(best) ? best : "USD") as Currency;
}
