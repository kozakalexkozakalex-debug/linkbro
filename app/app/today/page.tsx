import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import { CORE_NEG, hoursSince } from "@/lib/project";
import { daysLeft, fmtAmount, payState, realCost } from "@/lib/money";
import FindButton from "./FindButton";

// «Сьогодні»: что нужно сделать прямо сейчас. Список собирается сам из данных проектов.
type Row = {
  id: string;
  project_id: string;
  domain: string;
  assignee: string | null;
  core_status: string;
  med_base: string;
  indicator: string | null;
  indicator_at: string | null;
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
  link_status: string;
  guarantee_until: string | null;
  article_url: string;
};

type Search = Promise<{ who?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team, user } = await getTeamContext();
  const { t, intl } = await getI18n();
  const all = sp.who === "all" || (sp.who == null && team.role === "lead");

  const rows = await fetchAll<Row>((from, to) => {
    let q = supabase
      .from("project_donors")
      .select("id, project_id, domain, assignee, core_status, med_base, indicator, indicator_at, gp_price, gp_currency, gp_commission, pay_status, gp_status, in_gp, link_status, guarantee_until, article_url")
      .eq("team_id", team.id)
      .eq("fg_status", "core");
    if (!all) q = q.eq("assignee", user.id);
    return q.order("id").range(from, to);
  });
  const { data: pData } = await supabase.from("projects").select("id, name").eq("team_id", team.id);
  const pName = new Map(((pData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const live = rows.filter((r) => !CORE_NEG.includes(r.core_status) && r.core_status !== "Published");
  const early = (r: Row) => ["new_core", "OK_Cat", "In communication", ""].includes(r.core_status);
  const sections: { key: MsgKey; hint: MsgKey; tone: string; list: Row[]; extra?: (r: Row) => string; find?: boolean }[] = [
    { key: "today.broken", hint: "today.brokenHint", tone: "pill-bad", list: rows.filter((r) => ["missing", "nofollow", "noindex"].includes(r.link_status) && (daysLeft(r.guarantee_until) ?? -1) >= 0) },
    {
      key: "today.stale",
      hint: "today.staleHint",
      tone: "pill-warn",
      list: live.filter((r) => r.indicator === "waiting" && (hoursSince(r.indicator_at) ?? 0) > 72),
      extra: (r) => t("unit.days", { n: Math.round((hoursSince(r.indicator_at) ?? 0) / 24) }),
    },
    { key: "today.replied", hint: "today.repliedHint", tone: "pill-ok", list: live.filter((r) => r.indicator === "replied" && early(r)) },
    { key: "today.toWrite", hint: "today.toWriteHint", tone: "", list: live.filter((r) => r.med_base && !r.indicator && early(r)) },
    { key: "today.noMed", hint: "today.noMedHint", tone: "", list: live.filter((r) => !r.med_base && early(r)), find: true },
    {
      key: "today.toPay",
      hint: "today.toPayHint",
      tone: "pill-warn",
      list: rows.filter((r) => payState(r) === "due"),
      extra: (r) => fmtAmount(realCost(r), r.gp_currency || "USD", intl),
    },
    { key: "today.noArticle", hint: "today.noArticleHint", tone: "", list: live.filter((r) => ["Price_ok", "client_OK", "Paid"].includes(r.core_status) && !r.article_url) },
    {
      key: "today.guarantee",
      hint: "today.guaranteeHint",
      tone: "pill-warn",
      list: rows.filter((r) => {
        const d = daysLeft(r.guarantee_until);
        return d != null && d >= 0 && d <= 7;
      }),
      extra: (r) => t("unit.days", { n: daysLeft(r.guarantee_until) ?? 0 }),
    },
  ];
  const total = sections.reduce((a, s) => a + s.list.length, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-medium">{t("nav.today")}</h1>
          <p className="mt-1 text-mute">{total ? t("today.lead", { n: total }) : t("today.clear")}</p>
        </div>
        <div className="seg" role="group">
          <Link href="/app/today?who=me" className={`px-3 py-1.5 text-sm ${!all ? "seg-on" : ""}`}>{t("task.mine")}</Link>
          <Link href="/app/today?who=all" className={`px-3 py-1.5 text-sm ${all ? "seg-on" : ""}`}>{t("task.all")}</Link>
        </div>
      </div>

      {sections
        .filter((s) => s.list.length > 0)
        .map((s) => {
          const byProject = [...new Set(s.list.map((r) => r.project_id))];
          return (
            <details key={s.key} className="card" open={s.list.length <= 8}>
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className={`pill ${s.tone}`}>{s.list.length}</span>
                <span className="flex-1 font-semibold">{t(s.key)}</span>
                <span className="text-mute" aria-hidden="true">▾</span>
              </summary>
              <p className="mt-1 text-sm text-mute">{t(s.hint)}</p>
              {s.find && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {byProject.map((pid) => <FindButton key={pid} projectId={pid} label={`${t("work.find")} · ${pName.get(pid) ?? ""}`} />)}
                </div>
              )}
              <ul className="mt-2 divide-y divide-line text-sm">
                {s.list.slice(0, 50).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/app/projects/${r.project_id}?tab=work&q=${encodeURIComponent(r.domain)}`}
                      className="flex items-center gap-2 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono">{r.domain}</span>
                      <span className="pill max-sm:hidden">{pName.get(r.project_id)}</span>
                      {s.extra && <span className="font-mono text-xs" suppressHydrationWarning>{s.extra(r)}</span>}
                      <span className="text-mute" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
    </div>
  );
}
