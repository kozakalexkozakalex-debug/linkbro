// Этапы канбана. Этап вычисляется из статуса и индикатора, отдельно не хранится.
import { CORE_NEG } from "@/lib/project";
import type { MsgKey } from "@/lib/i18n/config";

export const STAGES = ["find", "written", "replied", "agreed", "article", "paid", "published"] as const;
export type Stage = (typeof STAGES)[number] | "dropped";

export const STAGE_KEY: Record<Stage, MsgKey> = {
  find: "stage.find",
  written: "stage.written",
  replied: "stage.replied",
  agreed: "stage.agreed",
  article: "stage.article",
  paid: "stage.paid",
  published: "stage.published",
  dropped: "stage.dropped",
};

type D = { core_status: string; indicator: string | null; med_base?: string };

export function stageOf(d: D, customNeg: string[] = []): Stage {
  const s = d.core_status;
  if (CORE_NEG.includes(s) || customNeg.includes(s)) return "dropped";
  if (s === "Published") return "published";
  if (s === "Paid") return "paid";
  if (s === "Sent_article") return "article";
  if (s === "Price_ok" || s === "client_OK") return "agreed";
  if (d.indicator === "replied") return "replied";
  if (d.indicator === "sent" || d.indicator === "waiting") return "written";
  return "find";
}

// Какие поля поменять, чтобы донор оказался на этапе
export function moveTo(stage: Stage): { field: string; value: string }[] {
  switch (stage) {
    case "find":
      return [{ field: "core_status", value: "new_core" }, { field: "indicator", value: "" }];
    case "written":
      return [{ field: "core_status", value: "In communication" }, { field: "indicator", value: "waiting" }];
    case "replied":
      return [{ field: "core_status", value: "In communication" }, { field: "indicator", value: "replied" }];
    case "agreed":
      return [{ field: "core_status", value: "Price_ok" }];
    case "article":
      return [{ field: "core_status", value: "Sent_article" }];
    case "paid":
      return [{ field: "core_status", value: "Paid" }, { field: "gp_status", value: "Paid" }];
    case "published":
      return [{ field: "core_status", value: "Published" }];
    default:
      return [];
  }
}
