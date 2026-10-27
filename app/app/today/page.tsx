import ModuleTabs from "@/components/ModuleTabs";
import Link from "next/link";
import Chevron from "@/components/Chevron";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { getI18n } from "@/lib/i18n/server";
import { hoursSince } from "@/lib/project";
import { daysLeft, fmtAmount, realCost } from "@/lib/money";
import { ATT_HINT, ATT_TITLE, ATT_TONE, attention, type AttKey } from "@/lib/attention";
import FindButton from "./FindButton";

// «Сьогодні»: что нужно сделать прямо сейчас. Список собирается сам из данных проектов.
type Row = {
  id: string;
  project_id: string;
  domain: string;
  assignee: string | null;
  fg_status: string;
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
  next_action_at: string | null;
  next_action: string;
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
      .select("id, project_id, domain, assignee, fg_status, core_status, med_base, indicator, indicator_at, gp_price, gp_currency, gp_commission, pay_status, gp_status, in_gp, link_status, guarantee_until, article_url, next_action_at, next_action")
      .eq("team_id", team.id)
      .eq("fg_status", "core");
    if (!all) q = q.eq("assignee", user.id);
    return q.order("id").range(from, to);
  });
  const [{ data: pData }, { count: unread }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("team_id", team.id),
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("team_id", team.id).eq("is_read", false),
  ]);
  const pName = new Map(((pData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const extra: Partial<Record<AttKey, (r: Row) => string>> = {
    next: (r) => `${(r.next_action_at ?? "").split("-").reverse().join(".")}${r.next_action ? " · " + r.next_action : ""}`,
    stale: (r) => t("unit.days", { n: Math.round((hoursSince(r.indicator_at) ?? 0) / 24) }),
    toPay: (r) => fmtAmount(realCost(r), r.gp_currency || "USD", intl),
    guarantee: (r) => t("unit.days", { n: daysLeft(r.guarantee_until) ?? 0 }),
  };
  const sections = attention(rows).map((a) => ({
    ...a,
    key: ATT_TITLE[a.key],
    hint: ATT_HINT[a.key],
    tone: ATT_TONE[a.key],
    extra: extra[a.key],
    find: a.key === "noMed",
    anchor: a.key,
  }));
  const total = sections.reduce((a, s) => a + s.list.length, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ModuleTabs module="dashboard" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="page-title">{t("nav.today")}</h1>
          <p className="mt-1 text-mute">{total ? t("today.lead", { n: total }) : t("today.clear")}</p>
        </div>
        <div className="seg" role="group">
          <Link href="/app/today?who=me" className={`px-3 py-1.5 text-sm ${!all ? "seg-on" : ""}`}>{t("task.mine")}</Link>
          <Link href="/app/today?who=all" className={`px-3 py-1.5 text-sm ${all ? "seg-on" : ""}`}>{t("task.all")}</Link>
        </div>
      </div>

      {(unread ?? 0) > 0 && (
        <Link href="/app/inbox" className="card flex items-center gap-3 border-accent">
          <span className="pill pill-ok">{unread}</span>
          <span className="flex-1 font-semibold">{t("inbox.unread", { n: unread ?? 0 })}</span>
          <Chevron className="text-mute" />
        </Link>
      )}

      {sections
        .filter((s) => s.list.length > 0)
        .map((s) => {
          const byProject = [...new Set(s.list.map((r) => r.project_id))];
          return (
            <details key={s.key} id={s.anchor} className="card" open={s.list.length <= 8}>
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className={`pill ${s.tone}`}>{s.list.length}</span>
                <span className="flex-1 font-semibold">{t(s.key)}</span>
                <Chevron dir="down" className="text-mute" />
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
                      <Chevron className="text-mute" />
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
