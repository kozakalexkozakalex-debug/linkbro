import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { getI18n } from "@/lib/i18n/server";
import { fmtAmount, fmtMoney, addTo, realCost, payState, type ByCurrency } from "@/lib/money";
import { CORE_NEG } from "@/lib/project";

// Профиль посредника: все его сайты, цены, как он отвечает и сколько раз довёл до публикации.
type Search = Promise<{ c?: string }>;
type Row = {
  id: string;
  project_id: string;
  domain: string;
  core_status: string;
  indicator: string | null;
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
};

export default async function MedProfile({ searchParams }: { searchParams: Search }) {
  const contact = ((await searchParams).c ?? "").trim();
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();

  const sites = await fetchAll<{ domain: string; price: string }>((from, to) =>
    supabase.from("intermediaries").select("domain, price").eq("team_id", team.id).eq("intermediary", contact).order("domain").range(from, to),
  );
  const work = await fetchAll<Row>((from, to) =>
    supabase
      .from("project_donors")
      .select("id, project_id, domain, core_status, indicator, gp_price, gp_currency, gp_commission, pay_status, gp_status, in_gp")
      .eq("team_id", team.id)
      .eq("med_base", contact)
      .order("id")
      .range(from, to),
  );
  const { data: pData } = await supabase.from("projects").select("id, name").eq("team_id", team.id);
  const pName = new Map(((pData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const written = work.filter((r) => r.indicator).length;
  const replied = work.filter((r) => r.indicator === "replied" || ["Price_ok", "client_OK", "Sent_article", "Paid", "Published"].includes(r.core_status)).length;
  const published = work.filter((r) => r.core_status === "Published").length;
  const dropped = work.filter((r) => CORE_NEG.includes(r.core_status)).length;
  const paid: ByCurrency = {};
  for (const r of work) if (payState(r) === "paid") addTo(paid, r.gp_currency, realCost(r));
  const prices = work.filter((r) => r.gp_price != null);
  const avg = prices.length ? prices.reduce((a, r) => a + (r.gp_price ?? 0), 0) / prices.length : null;
  const inWork = new Set(work.map((r) => r.domain));
  const free = sites.filter((s) => !inWork.has(s.domain));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <Link href="/app/intermediaries" className="text-sm underline">← {t("nav.intermediaries")}</Link>
        <h1 className="mt-1 break-all font-display text-xl font-medium">{contact || "—"}</h1>
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(sites.length), t("medp.sites")],
          [written ? `${Math.round((replied / written) * 100)}%` : "—", t("medp.replyRate")],
          [String(published), t("medp.published")],
          [avg == null ? "—" : fmtAmount(avg, prices[0]?.gp_currency || "USD", intl), t("medp.avgPrice")],
        ].map(([v, l]) => (
          <div key={l} className="card">
            <p className="font-mono text-xl font-semibold">{v}</p>
            <p className="text-xs text-mute">{l}</p>
          </div>
        ))}
      </section>
      <p className="text-sm text-mute">{t("medp.summary", { dropped, paid: fmtMoney(paid, intl) })}</p>

      {free.length > 0 && (
        <section className="card">
          <p className="lbl mb-1">{t("medp.free", { n: free.length })}</p>
          <p className="mb-2 text-sm text-mute">{t("medp.freeHint")}</p>
          <ul className="grid gap-1 font-mono text-sm sm:grid-cols-2">
            {free.map((s) => <li key={s.domain}>{s.domain} <span className="text-mute">{s.price}</span></li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <p className="lbl mb-2">{t("medp.history")}</p>
        {work.length === 0 ? (
          <p className="text-sm text-mute">{t("common.none")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {work.map((r) => (
              <li key={r.id}>
                <Link href={`/app/projects/${r.project_id}?tab=work&q=${encodeURIComponent(r.domain)}`} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono">{r.domain}</span>
                  <span className="pill max-sm:hidden">{pName.get(r.project_id)}</span>
                  <span className="pill">{r.core_status}</span>
                  {r.gp_price != null && <span className="font-mono text-xs">{fmtAmount(r.gp_price, r.gp_currency || "USD", intl)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
