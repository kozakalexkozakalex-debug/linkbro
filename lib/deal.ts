// Путь сделки в Outreach одной линией + «что дальше».
// Этапы: Контакт → Написали → Відповіли → Ціна → Погодили → Стаття → Оплата → Опубліковано → Моніторинг.
// Считается из уже существующих полей сделки, ничего нового в базе не нужно.
import { STAGES, stageOf, type Stage } from "@/lib/stages";
import type { MsgKey } from "@/lib/i18n/config";

export type DealMark = "ok" | "now" | "todo" | "no" | "warn";
export type DealStepKey = "contact" | "written" | "replied" | "price" | "agreed" | "article" | "paid" | "published" | "monitor";
export const DEAL_STEPS: DealStepKey[] = ["contact", "written", "replied", "price", "agreed", "article", "paid", "published", "monitor"];
export const DEAL_STEP_KEY: Record<DealStepKey, MsgKey> = {
  contact: "dp.contact",
  written: "dp.written",
  replied: "dp.replied",
  price: "dp.price",
  agreed: "dp.agreed",
  article: "dp.article",
  paid: "dp.paid",
  published: "dp.published",
  monitor: "dp.monitor",
};

// Короткие подписи для таблицы (точки по 34px)
export const DEAL_STEP_SHORT: Record<DealStepKey, MsgKey> = {
  contact: "dp.sContact",
  written: "dp.sWritten",
  replied: "dp.sReplied",
  price: "dp.sPrice",
  agreed: "dp.sAgreed",
  article: "dp.sArticle",
  paid: "dp.sPaid",
  published: "dp.sPublished",
  monitor: "dp.sMonitor",
};

// Вкладка карточки, где делается следующий шаг
export type DealTab = "chat" | "prices" | "article" | "pub";
const STEP_TAB: Record<DealStepKey, DealTab> = {
  contact: "chat",
  written: "chat",
  replied: "chat",
  price: "prices",
  agreed: "prices",
  article: "article",
  paid: "prices",
  published: "pub",
  monitor: "pub",
};
const NEXT_KEY: Record<DealStepKey, MsgKey> = {
  contact: "dp.nContact",
  written: "dp.nWrite",
  replied: "dp.nWait",
  price: "dp.nPrice",
  agreed: "dp.nAgree",
  article: "dp.nArticle",
  paid: "dp.nPay",
  published: "dp.nPublish",
  monitor: "dp.nMonitor",
};

export type DealLike = {
  stage?: string | null;
  core_status: string;
  indicator: string | null;
  med_base: string;
  gp_price: number | string | null;
  pay_status?: string;
  article_status?: string;
  article_url?: string;
  link_status?: string;
};

const at = (s: Stage) => (STAGES as readonly string[]).indexOf(s);

export function dealPath(d: DealLike): { steps: { key: DealStepKey; mark: DealMark }[]; current: DealStepKey | null; lost: boolean } {
  const st = stageOf({ stage: d.stage, core_status: d.core_status, indicator: d.indicator });
  const lost = st === "lost";
  const i = lost ? -1 : at(st);
  const hasPrice = d.gp_price != null && String(d.gp_price).trim() !== "";
  const link = d.link_status ?? "";
  const done: Record<DealStepKey, boolean> = {
    contact: !!d.med_base?.trim(),
    written: i >= at("contacted"),
    replied: i >= at("replied"),
    price: hasPrice || i >= at("agreed"),
    agreed: i >= at("agreed"),
    article: i >= at("sent") || d.article_status === "sent" || d.article_status === "accepted",
    paid: i >= at("paid") || d.pay_status === "paid",
    published: i >= at("published") || !!d.article_url?.trim(),
    monitor: link === "ok",
  };
  const current = DEAL_STEPS.find((k) => !done[k]) ?? null;
  const steps = DEAL_STEPS.map((key) => {
    let mark: DealMark = done[key] ? "ok" : key === current ? (lost ? "no" : "now") : "todo";
    if (key === "monitor" && ["missing", "nofollow", "noindex", "anchor", "target"].includes(link)) mark = "no";
    else if (key === "monitor" && link === "suspect") mark = "warn";
    else if (key === "monitor" && ["error", "blocked"].includes(link)) mark = "warn";
    return { key, mark };
  });
  return { steps, current, lost };
}

// Подсказка «що далі» и вкладка, где это сделать
export function dealNext(d: DealLike): { key: MsgKey; tab: DealTab; step: DealStepKey } | null {
  const p = dealPath(d);
  if (p.lost) return { key: "dp.nLost", tab: "chat", step: p.current ?? "contact" };
  const bad = p.steps.find((s) => s.key === "monitor" && s.mark === "no");
  if (bad) return { key: "dp.nRestore", tab: "pub", step: "monitor" };
  if (!p.current) return null;
  return { key: NEXT_KEY[p.current], tab: STEP_TAB[p.current], step: p.current };
}
