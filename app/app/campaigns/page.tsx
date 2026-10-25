import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { fetchAll } from "@/lib/fetchAll";
import { fmtAmount, CURRENCIES } from "@/lib/money";
import { CAMPAIGN_COLS, campaignStats, type Campaign } from "@/lib/campaigns";
import ModuleHead from "@/components/ModuleHead";
import { createCampaign } from "./actions";
import type { MsgKey } from "@/lib/i18n/config";

// Outreach → Кампанії: хвилі угод зі спільною метою (скільки посилань, бюджет, шаблон листа)
type DealRow = { campaign_id: string; stage: string; core_status: string; indicator: string | null; gp_price: number | null; gp_currency: string; gp_commission: number; extra_cost: number; pay_status: string };
const STATUS_KEY: Record<Campaign["status"], MsgKey> = { active: "cmp.sActive", paused: "cmp.sPaused", done: "cmp.sDone" };

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const [{ supabase, team }, { t, intl }, { projectId, projects }] = await Promise.all([getTeamContext(), getI18n(), getScope()]);
  let cq = supabase.from("campaigns").select(CAMPAIGN_COLS).eq("team_id", team.id).order("created_at", { ascending: false });
  if (projectId) cq = cq.eq("project_id", projectId);
  const [{ data: cData }, deals] = await Promise.all([
    cq,
    fetchAll<DealRow>((from, to) => {
      let q = supabase.from("project_donors").select("campaign_id, stage, core_status, indicator, gp_price, gp_currency, gp_commission, extra_cost, pay_status").eq("team_id", team.id).not("campaign_id", "is", null);
      if (projectId) q = q.eq("project_id", projectId);
      return q.order("id").range(from, to);
    }),
  ]);
  const campaigns = (cData ?? []) as Campaign[];
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const byCampaign = new Map<string, DealRow[]>();
  for (const d of deals) (byCampaign.get(d.campaign_id) ?? byCampaign.set(d.campaign_id, []).get(d.campaign_id)!).push(d);

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("cmp.title")} project={projectId ? pName.get(projectId) : t("dash.allProjects")} module="outreach" />
      <p className="max-w-3xl text-sm text-mute">{t("cmp.lead")}</p>
      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}

      {campaigns.length === 0 ? (
        <p className="card text-center text-mute">{t("cmp.empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => {
            const s = campaignStats(byCampaign.get(c.id) ?? [], c.currency);
            const goalPct = c.goal ? Math.min(100, (s.published / c.goal) * 100) : 0;
            const spent = s.spent + s.committed;
            return (
              <li key={c.id}>
                <Link href={`/app/campaigns/${c.id}`} className="card flex flex-col gap-2 hover:border-accent">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    <span className={`pill ${c.status === "active" ? "pill-ok" : ""}`}>{t(STATUS_KEY[c.status])}</span>
                  </div>
                  {!projectId && <span className="text-xs text-mute">{pName.get(c.project_id)}</span>}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      [s.deals, t("cmp.deals")],
                      [s.contacted, t("dp.written")],
                      [s.replyRate == null ? "—" : `${s.replyRate}%`, t("cmp.reply")],
                      [s.agreed, t("dp.agreed")],
                    ].map(([v, l]) => (
                      <div key={String(l)}>
                        <p className="font-mono text-lg font-semibold">{v}</p>
                        <p className="text-[11px] text-mute">{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs"><span>{t("cmp.goalLine", { n: s.published, g: c.goal || "—" })}</span><span className="font-mono">{c.budget ? `${fmtAmount(spent, c.currency, intl)} / ${fmtAmount(Number(c.budget), c.currency, intl)}` : ""}</span></div>
                  <span className="h-1.5 overflow-hidden rounded bg-inset"><span className="block h-full rounded bg-accent" style={{ width: `${goalPct}%` }} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {projectId ? (
        <form action={createCampaign} className="card flex flex-col gap-3">
          <p className="lbl">{t("cmp.new")}</p>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_90px_1fr]">
            <input name="name" required className="inp" placeholder={t("cmp.namePh")} aria-label={t("cmp.name")} />
            <input name="goal" inputMode="numeric" className="inp" placeholder={t("cmp.goal")} aria-label={t("cmp.goal")} />
            <input name="budget" inputMode="decimal" className="inp" placeholder={t("cmp.budget")} aria-label={t("cmp.budget")} />
            <select name="currency" className="inp" aria-label={t("common.currency")} defaultValue="USD">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input name="ends_on" type="date" className="inp" aria-label={t("cmp.endsOn")} />
          </div>
          <textarea name="template" className="inp min-h-24 text-sm" placeholder={t("cmp.templatePh")} aria-label={t("cmp.template")} />
          <button type="submit" className="btn btn-pri self-start">{t("cmp.create")}</button>
        </form>
      ) : (
        <p className="text-sm text-mute">{t("cmp.pickProject")}</p>
      )}
    </div>
  );
}
