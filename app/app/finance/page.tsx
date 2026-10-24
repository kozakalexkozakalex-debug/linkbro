import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { addTo, daysLeft, fmtAmount, fmtMoney, payState, realCost, type ByCurrency } from "@/lib/money";
import { fmtDate } from "@/lib/global";
import { isThisMonth } from "@/lib/project";
import { getI18n } from "@/lib/i18n/server";
import PaymentsBlock from "./PaymentsBlock";
import type { Payment } from "../projects/deal-actions";

type Row = {
  id: string;
  project_id: string;
  domain: string;
  gp_med: string;
  med_base: string;
  gp_source: string;
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
  paid_at: string | null;
  guarantee_until: string | null;
  link_status: string;
};

export default async function FinancePage() {
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();
  const money = (m: ByCurrency) => fmtMoney(m, intl);
  const rows = await fetchAll<Row>((from, to) =>
    supabase
      .from("project_donors")
      .select("id, project_id, domain, gp_med, med_base, gp_source, gp_price, gp_currency, gp_commission, pay_status, gp_status, in_gp, paid_at, guarantee_until, link_status")
      .eq("team_id", team.id)
      .eq("in_gp", true)
      .order("id")
      .range(from, to),
  );
  const [{ data: pData }, { data: payData }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at"),
    supabase.from("payments").select("id, payee_kind, payee, amount, currency, status, paid_at, note, created_at, project_id, donor_id").eq("team_id", team.id).order("created_at", { ascending: false }).limit(500),
  ]);
  const payments = ((payData ?? []) as Payment[]).sort((a, b) => (a.status === b.status ? 0 : a.status === "due" ? -1 : 1));
  const pName = new Map(((pData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const paid: ByCurrency = {};
  const paidMonth: ByCurrency = {};
  const due: ByCurrency = {};
  const refund: ByCurrency = {};
  const byMed = new Map<string, { due: ByCurrency; paid: ByCurrency; count: number }>();
  const byProject = new Map<string, { due: ByCurrency; paid: ByCurrency }>();
  const dueRows: Row[] = [];

  for (const r of rows) {
    const cost = realCost(r);
    const st = payState(r);
    const med = r.gp_med || r.med_base || t("fin.noMed");
    const m = byMed.get(med) ?? { due: {}, paid: {}, count: 0 };
    const p = byProject.get(r.project_id) ?? { due: {}, paid: {} };
    if (st === "paid") {
      addTo(paid, r.gp_currency, cost);
      addTo(m.paid, r.gp_currency, cost);
      addTo(p.paid, r.gp_currency, cost);
      if (isThisMonth(r.paid_at)) addTo(paidMonth, r.gp_currency, cost);
    } else if (st === "due") {
      addTo(due, r.gp_currency, cost);
      addTo(m.due, r.gp_currency, cost);
      addTo(p.due, r.gp_currency, cost);
      dueRows.push(r);
    } else if (st === "refund") {
      addTo(refund, r.gp_currency, cost);
    }
    m.count++;
    byMed.set(med, m);
    byProject.set(r.project_id, p);
  }

  // Ссылки сняты, а гарантия ещё действует → можно требовать возврат
  const claimable = rows.filter(
    (r) => ["missing", "nofollow", "noindex"].includes(r.link_status) && (daysLeft(r.guarantee_until) ?? -1) >= 0,
  );

  const meds = [...byMed.entries()].sort((a, b) => Object.keys(b[1].due).length - Object.keys(a[1].due).length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.money")}</h1>
        <p className="mt-1 max-w-2xl text-mute">
          {t("fin.lead")}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [money(due), t("pay.due")],
          [money(paidMonth), t("fin.paidMonth")],
          [money(paid), t("fin.paidAll")],
          [money(refund), t("pay.refund")],
        ].map(([v, l]) => (
          <div key={l} className="card">
            <p className="font-mono text-xl font-semibold">{v}</p>
            <p className="text-xs text-mute">{l}</p>
          </div>
        ))}
      </section>

      <PaymentsBlock rows={payments} projects={(pData ?? []) as { id: string; name: string }[]} isLead={team.role === "lead"} />

      {claimable.length > 0 && (
        <section className="card border-bad">
          <p className="lbl mb-2 text-bad">{t("fin.claimable")}</p>
          <ul className="divide-y divide-line text-sm">
            {claimable.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/app/projects/${r.project_id}?tab=work`} className="font-mono underline">{r.domain}</Link>
                <span className="pill">{pName.get(r.project_id)}</span>
                <span className="pill">{r.gp_source || t("fin.noSource")}</span>
                <span className="pill pill-warn" suppressHydrationWarning>{t("fin.guaranteeLeft", { n: daysLeft(r.guarantee_until) ?? 0 })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <p className="lbl mb-2">{t("fin.byMed")}</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{[t("med.intermediary"), t("fin.links"), t("fin.debt"), t("pay.paid")].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {meds.map(([med, m]) => (
                  <tr key={med}>
                    <td className="max-w-56 truncate" title={med}>{med}</td>
                    <td className="font-mono">{m.count}</td>
                    <td className="font-mono">{Object.keys(m.due).length ? money(m.due) : "—"}</td>
                    <td className="font-mono">{Object.keys(m.paid).length ? money(m.paid) : "—"}</td>
                  </tr>
                ))}
                {meds.length === 0 && <tr><td colSpan={4} className="text-center text-mute">{t("fin.noDeals")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <p className="lbl mb-2">{t("fin.byProject")}</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{[t("common.project"), t("pay.due"), t("pay.paid")].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {[...byProject.entries()].map(([pid, p]) => (
                  <tr key={pid}>
                    <td><Link href={`/app/projects/${pid}?tab=work`} className="underline">{pName.get(pid) ?? "—"}</Link></td>
                    <td className="font-mono">{Object.keys(p.due).length ? money(p.due) : "—"}</td>
                    <td className="font-mono">{Object.keys(p.paid).length ? money(p.paid) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section>
        <p className="lbl mb-2">{t("fin.waiting")} · {dueRows.length}</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{[t("med.donor"), t("common.project"), t("med.intermediary"), t("gp.source"), t("common.price"), t("fin.commission"), t("fin.real"), ""].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>
              {dueRows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">{r.domain}</td>
                  <td>{pName.get(r.project_id)}</td>
                  <td className="max-w-48 truncate">{r.gp_med || r.med_base || "—"}</td>
                  <td>{r.gp_source || "—"}</td>
                  <td className="font-mono">{r.gp_price == null ? "—" : fmtAmount(r.gp_price, r.gp_currency, intl)}</td>
                  <td className="font-mono">{Number(r.gp_commission) ? `${r.gp_commission}%` : "—"}</td>
                  <td className="font-mono">{fmtAmount(realCost(r), r.gp_currency, intl)}</td>
                  <td><Link href={`/app/projects/${r.project_id}?tab=work`} className="btn btn-sm">{t("common.open")}</Link></td>
                </tr>
              ))}
              {dueRows.length === 0 && <tr><td colSpan={8} className="text-center text-mute">{t("fin.noDebts")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-mute">{t("common.updatedAt", { date: fmtDate(new Date().toISOString(), intl) })}</p>
    </div>
  );
}
