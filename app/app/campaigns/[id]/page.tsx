import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";
import { CURRENCIES, fmtAmount } from "@/lib/money";
import { CAMPAIGN_COLS, campaignStats, type Campaign } from "@/lib/campaigns";
import ModuleHead from "@/components/ModuleHead";
import { deleteCampaign, updateCampaign } from "../actions";
import CampaignDeals from "./CampaignDeals";

// Кампанія: показники хвилі, її угоди з лінією-шляхом, лист «тим, кому ще не писали», налаштування
export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [{ supabase, team }, { t, intl }] = await Promise.all([getTeamContext(), getI18n()]);
  const [{ data: c }, deals] = await Promise.all([
    supabase.from("campaigns").select(CAMPAIGN_COLS).eq("id", id).eq("team_id", team.id).maybeSingle(),
    fetchAll<ProjectDonor>((from, to) => supabase.from("project_donors").select(DONOR_COLUMNS).eq("team_id", team.id).eq("campaign_id", id).order("domain").range(from, to)),
  ]);
  if (!c) notFound();
  const cmp = c as Campaign;
  const { data: p } = await supabase.from("projects").select("name, link_budget, budget_currency").eq("id", cmp.project_id).eq("team_id", team.id).maybeSingle();
  const proj = p as { name: string; link_budget: number | null; budget_currency: string } | null;
  const s = campaignStats(deals, cmp.currency);
  const avg = s.agreed ? (s.spent + s.committed) / s.agreed : null;
  const fa = (n: number) => fmtAmount(n, cmp.currency, intl);

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={cmp.name} project={proj?.name} module="outreach" />
      <Link href="/app/campaigns" className="text-sm underline">← {t("cmp.title")}</Link>
      {sp.saved && <p className="note note-ok" role="status">{t("common.saved")}</p>}
      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [String(s.deals), t("cmp.deals")],
          [String(s.contacted), t("dp.written")],
          [s.replyRate == null ? "—" : `${s.replyRate}%`, t("cmp.reply")],
          [`${s.agreed}`, t("dp.agreed")],
          [`${s.published}${cmp.goal ? ` / ${cmp.goal}` : ""}`, t("dp.published")],
          [avg == null ? "—" : fa(avg), proj?.link_budget ? t("cmp.avgVs", { x: fmtAmount(Number(proj.link_budget), proj.budget_currency, intl) }) : t("cmp.avg")],
        ].map(([v, l]) => (
          <div key={l} className="card py-3">
            <p className="font-mono text-xl font-semibold">{v}</p>
            <p className="text-xs text-mute">{l}</p>
          </div>
        ))}
      </section>
      {cmp.budget ? (
        <p className="text-sm text-mute">
          {t("cmp.money", { spent: fa(s.spent), committed: fa(s.committed), budget: fa(Number(cmp.budget)), left: fa(Number(cmp.budget) - s.spent - s.committed) })}
        </p>
      ) : null}

      <CampaignDeals campaignId={cmp.id} template={cmp.template} rows={deals} />

      <details className="card">
        <summary className="cursor-pointer font-semibold">{t("cmp.settings")}</summary>
        <form action={updateCampaign} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={cmp.id} />
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_90px_1fr_1fr]">
            <input name="name" className="inp" defaultValue={cmp.name} aria-label={t("cmp.name")} />
            <input name="goal" inputMode="numeric" className="inp" defaultValue={cmp.goal || ""} placeholder={t("cmp.goal")} aria-label={t("cmp.goal")} />
            <input name="budget" inputMode="decimal" className="inp" defaultValue={cmp.budget ?? ""} placeholder={t("cmp.budget")} aria-label={t("cmp.budget")} />
            <select name="currency" className="inp" defaultValue={cmp.currency} aria-label={t("common.currency")}>
              {CURRENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <input name="ends_on" type="date" className="inp" defaultValue={cmp.ends_on ?? ""} aria-label={t("cmp.endsOn")} />
            <select name="status" className="inp" defaultValue={cmp.status} aria-label={t("common.status")}>
              <option value="active">{t("cmp.sActive")}</option>
              <option value="paused">{t("cmp.sPaused")}</option>
              <option value="done">{t("cmp.sDone")}</option>
            </select>
          </div>
          <textarea name="template" className="inp min-h-28 text-sm" defaultValue={cmp.template} placeholder={t("cmp.templatePh")} aria-label={t("cmp.template")} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-pri">{t("common.save")}</button>
          </div>
        </form>
        <form action={deleteCampaign} className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="id" value={cmp.id} />
          <button type="submit" className="btn btn-sm">{t("cmp.delete")}</button>
          <span className="ml-2 text-xs text-mute">{t("cmp.deleteHint")}</span>
        </form>
      </details>
    </div>
  );
}
