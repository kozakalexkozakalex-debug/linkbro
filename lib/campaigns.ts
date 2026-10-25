// Кампания: статистика волны по её сделкам (считается на лету, ничего не дублируем в базе)
import { STAGES, stageOf, type Stage } from "@/lib/stages";
import { realCost } from "@/lib/money";

export type Campaign = {
  id: string;
  project_id: string;
  name: string;
  goal: number;
  budget: number | null;
  currency: string;
  template: string;
  status: "active" | "paused" | "done";
  ends_on: string | null;
  created_at: string;
};
export const CAMPAIGN_COLS = "id, project_id, name, goal, budget, currency, template, status, ends_on, created_at";

type Deal = { stage?: string | null; core_status: string; indicator: string | null; gp_price: number | null; gp_currency: string; gp_commission: number; extra_cost?: number | null; pay_status?: string };

export type CampaignStats = { deals: number; contacted: number; replied: number; agreed: number; published: number; lost: number; spent: number; committed: number; replyRate: number | null };

export function campaignStats(deals: Deal[], currency: string): CampaignStats {
  const at = (s: Stage) => (STAGES as readonly string[]).indexOf(s);
  const s: CampaignStats = { deals: deals.length, contacted: 0, replied: 0, agreed: 0, published: 0, lost: 0, spent: 0, committed: 0, replyRate: null };
  for (const d of deals) {
    const st = stageOf(d);
    if (st === "lost") {
      s.lost++;
      continue;
    }
    const i = at(st);
    if (i >= at("contacted")) s.contacted++;
    if (i >= at("replied")) s.replied++;
    if (i >= at("agreed")) s.agreed++;
    if (st === "published") s.published++;
    if (i >= at("agreed") && (d.gp_currency || "USD") === currency) {
      if (i >= at("paid") || d.pay_status === "paid") s.spent += realCost(d);
      else s.committed += realCost(d);
    }
  }
  s.replyRate = s.contacted ? Math.round((s.replied / s.contacted) * 100) : null;
  return s;
}
