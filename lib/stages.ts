// Доски модулей проекта. У каждого модуля свои колонки; сделка одна.
import { CORE_NEG } from "@/lib/project";
import type { MsgKey } from "@/lib/i18n/config";

// ---------- Outreach: этап переговоров и статьи (поле stage) ----------
export const STAGES = ["find", "contacted", "replied", "negotiating", "agreed", "writing", "review", "sent", "paid", "published"] as const;
export type Stage = (typeof STAGES)[number] | "lost";
export const STAGE_KEY: Record<Stage, MsgKey> = {
  find: "stage.find",
  contacted: "stage.written",
  replied: "stage.replied",
  negotiating: "stage.negotiating",
  agreed: "stage.agreed",
  writing: "stage.writing",
  review: "stage.review",
  sent: "stage.sentArticle",
  paid: "stage.paid",
  published: "stage.published",
  lost: "stage.dropped",
};

type D = { stage?: string | null; core_status: string; indicator: string | null };

export function stageOf(d: D, customNeg: string[] = []): Stage {
  if (d.stage && (STAGES as readonly string[]).includes(d.stage)) return d.stage as Stage;
  if (d.stage === "lost") return "lost";
  const s = d.core_status;
  if (CORE_NEG.includes(s) || customNeg.includes(s)) return "lost";
  if (s === "Published") return "published";
  if (s === "Paid") return "paid";
  if (s === "Sent_article") return "sent";
  if (s === "Price_ok" || s === "client_OK") return "agreed";
  if (d.indicator === "replied") return "replied";
  if (d.indicator === "sent" || d.indicator === "waiting") return "contacted";
  return "find";
}

// ---------- Домени: пул проекта (поле fg_status) ----------
export const POOL = ["new", "check", "ok", "core", "out"] as const;
export type PoolCol = (typeof POOL)[number];
export const POOL_KEY: Record<PoolCol, MsgKey> = {
  new: "pool.new",
  check: "pool.check",
  ok: "pool.ok",
  core: "pool.core",
  out: "pool.out",
};
export const REJECT_REASONS = ["metrics", "topic", "geo", "price", "quality", "other"] as const;

// ---------- Моніторинг: состояние опубликованной ссылки ----------
export const MONITOR = ["unchecked", "ok", "warn", "error", "lost"] as const;
export type MonitorCol = (typeof MONITOR)[number];
export const MONITOR_KEY: Record<MonitorCol, MsgKey> = {
  unchecked: "mon.unchecked",
  ok: "mon.ok",
  warn: "mon.warn",
  error: "mon.error",
  lost: "mon.lost",
};
export function monitorOf(link: string): MonitorCol {
  if (link === "ok") return "ok";
  if (link === "missing") return "lost";
  if (["nofollow", "noindex", "anchor"].includes(link)) return "warn";
  if (["error", "blocked"].includes(link)) return "error";
  return "unchecked";
}

// ---------- Огляд проекта: где сейчас каждый сайт ----------
export const OVERVIEW = ["pool", "reserve", "outreach", "article", "published", "problem"] as const;
export type OverviewCol = (typeof OVERVIEW)[number] | "dropped";
export const OVERVIEW_KEY: Record<OverviewCol, MsgKey> = {
  pool: "ov.pool",
  reserve: "ov.reserve",
  outreach: "ov.outreach",
  article: "ov.article",
  published: "ov.published",
  problem: "ov.problem",
  dropped: "ov.dropped",
};
export function overviewOf(d: D & { fg_status: string; link_status: string }): OverviewCol {
  if (d.fg_status === "out") return "dropped";
  if (d.fg_status === "new" || d.fg_status === "check") return "pool";
  if (d.fg_status === "ok") return "reserve";
  const st = stageOf(d);
  if (st === "lost") return "dropped";
  if (st === "published") return ["missing", "nofollow", "noindex", "anchor"].includes(d.link_status) ? "problem" : "published";
  if (["agreed", "writing", "review", "sent", "paid"].includes(st)) return "article";
  return "outreach";
}
