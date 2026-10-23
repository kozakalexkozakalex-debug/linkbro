// «Потребує уваги»: что нужно сделать сейчас. Используется на дашборде и на странице «Сьогодні».
import { CORE_NEG, hoursSince } from "@/lib/project";
import { daysLeft, payState } from "@/lib/money";
import type { MsgKey } from "@/lib/i18n/config";

export type AttRow = {
  fg_status: string;
  core_status: string;
  med_base: string;
  indicator: string | null;
  indicator_at: string | null;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
  link_status: string;
  guarantee_until: string | null;
  article_url: string;
};

export type AttKey = "broken" | "stale" | "replied" | "toWrite" | "noMed" | "toPay" | "noArticle" | "guarantee";
export const ATT_TITLE: Record<AttKey, MsgKey> = {
  broken: "today.broken",
  stale: "today.stale",
  replied: "today.replied",
  toWrite: "today.toWrite",
  noMed: "today.noMed",
  toPay: "today.toPay",
  noArticle: "today.noArticle",
  guarantee: "today.guarantee",
};
export const ATT_HINT: Record<AttKey, MsgKey> = {
  broken: "today.brokenHint",
  stale: "today.staleHint",
  replied: "today.repliedHint",
  toWrite: "today.toWriteHint",
  noMed: "today.noMedHint",
  toPay: "today.toPayHint",
  noArticle: "today.noArticleHint",
  guarantee: "today.guaranteeHint",
};
export const ATT_TONE: Record<AttKey, string> = {
  broken: "pill-bad",
  stale: "pill-warn",
  replied: "pill-ok",
  toWrite: "",
  noMed: "",
  toPay: "pill-warn",
  noArticle: "",
  guarantee: "pill-warn",
};

export function attention<T extends AttRow>(rows: T[]): { key: AttKey; list: T[] }[] {
  const core = rows.filter((r) => r.fg_status === "core");
  const live = core.filter((r) => !CORE_NEG.includes(r.core_status) && r.core_status !== "Published");
  const early = (r: T) => ["new_core", "OK_Cat", "In communication", ""].includes(r.core_status);
  return [
    { key: "broken" as const, list: core.filter((r) => ["missing", "nofollow", "noindex"].includes(r.link_status) && (daysLeft(r.guarantee_until) ?? -1) >= 0) },
    { key: "stale" as const, list: live.filter((r) => r.indicator === "waiting" && (hoursSince(r.indicator_at) ?? 0) > 72) },
    { key: "replied" as const, list: live.filter((r) => r.indicator === "replied" && early(r)) },
    { key: "toWrite" as const, list: live.filter((r) => !!r.med_base && !r.indicator && early(r)) },
    { key: "noMed" as const, list: live.filter((r) => !r.med_base && early(r)) },
    { key: "toPay" as const, list: core.filter((r) => payState(r) === "due") },
    { key: "noArticle" as const, list: live.filter((r) => ["Price_ok", "client_OK", "Paid"].includes(r.core_status) && !r.article_url) },
    {
      key: "guarantee" as const,
      list: core.filter((r) => {
        const d = daysLeft(r.guarantee_until);
        return d != null && d >= 0 && d <= 7;
      }),
    },
  ];
}
