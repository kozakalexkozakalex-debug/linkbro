import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll } from "@/lib/fetchAll";
import { CORE_NEG, LINK_STATUS, type LinkStatus } from "@/lib/project";
import { daysLeft, fmtAmount, fmtMoney, payState, realCost, addTo, type ByCurrency } from "@/lib/money";
import {
  AN_COLUMNS,
  avg,
  currentMonth,
  delta,
  isValidMonth,
  mainCurrency,
  monthLabel,
  monthStats,
  rate,
  shiftMonth,
  type AnRow,
} from "@/lib/analytics";
import { HBars, Kpi, MonthBars, Progress } from "@/components/Charts";
import { STAGES, STAGE_KEY, stageOf } from "@/lib/stages";
import { ATT_TITLE, ATT_TONE, attention } from "@/lib/attention";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";

type Search = Promise<{ project?: string; tab?: string; m?: string }>;
type ProjectRow = {
  id: string;
  name: string;
  niche: string;
  plan_per_month: number;
  monthly_budget: number | null;
  budget_currency: string;
};

const TABS: { key: string; label: MsgKey }[] = [
  { key: "overview", label: "dash.tabOverview" },
  { key: "projects", label: "common.projects" },
  { key: "budgets", label: "dash.tabBudgets" },
  { key: "team", label: "team.title" },
  { key: "links", label: "gp.link" },
];

const pctTxt = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
type Cur = "USD" | "EUR" | "UAH";

export default async function Dashboard({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();
  const daysTxt = (n: number | null) => (n == null ? "—" : t("unit.days", { n: Math.round(n * 10) / 10 }));
  const ml = (m: string, style: "long" | "short" = "long") => monthLabel(m, style, intl);
  const fm = (m: ByCurrency) => fmtMoney(m, intl);
  const fa = (n: number, c: string) => fmtAmount(n, c, intl);
  const isLead = team.role === "lead";

  const { data: pData } = await supabase
    .from("projects")
    .select("id, name, niche, plan_per_month, monthly_budget, budget_currency")
    .eq("team_id", team.id)
    .order("created_at");
  const projects = (pData ?? []) as ProjectRow[];

  if (projects.length === 0) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-xl font-medium">{t("nav.dashboard")}</h1>
        <div className="card flex flex-col gap-3">
          <p>{t("dash.ready", { name: team.name })}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/input" className="btn btn-pri">{t("dash.addDonors")}</Link>
            {isLead && <Link href="/app/projects/new" className="btn">{t("proj.create")}</Link>}
            {isLead && <Link href="/app/team" className="btn">{t("dash.inviteBuilder")}</Link>}
          </div>
        </div>
      </div>
    );
  }

  const scope = projects.some((p) => p.id === sp.project) ? (sp.project as string) : "all";
  const tab = TABS.some((x) => x.key === sp.tab) ? (sp.tab as string) : "overview";
  const now = currentMonth();
  const month = isValidMonth(sp.m) && sp.m <= now ? sp.m : now;
  const prev = shiftMonth(month, -1);

  // Все независимые запросы — параллельно
  const [all, log, members] = await Promise.all([
    fetchAll<AnRow>((from, to) =>
    supabase.from("project_donors").select(AN_COLUMNS).eq("team_id", team.id).order("id").range(from, to),
    ),
    fetchAll<{ donor_id: string | null; created_at: string }>((from, to) =>
    supabase
      .from("activity_log")
      .select("donor_id, created_at")
      .eq("team_id", team.id)
      .eq("field", "core_status")
      .eq("new_value", "In communication")
      .order("created_at")
      .range(from, to),
    ),
    loadMembers(supabase, team.id),
  ]);
  const commStart = new Map<string, string>();
  for (const l of log) if (l.donor_id && !commStart.has(l.donor_id)) commStart.set(l.donor_id, l.created_at);

  const pById = new Map(projects.map((p) => [p.id, p]));
  const rows = scope === "all" ? all : all.filter((r) => r.project_id === scope);
  const shown = scope === "all" ? projects : projects.filter((p) => p.id === scope);
  const cur = mainCurrency(rows, scope !== "all" ? pById.get(scope)?.budget_currency : undefined);

  // ---------- Показатели месяца ----------
  const ms = monthStats(rows, month, commStart);
  const ps = monthStats(rows, prev, commStart);
  const plan = shown.reduce((a, p) => a + p.plan_per_month, 0);
  const budget = shown.filter((p) => p.monthly_budget && p.budget_currency === cur).reduce((a, p) => a + (p.monthly_budget ?? 0), 0);
  const spend = ms.spend[cur] ?? 0;
  const avgCost = ms.paidCount[cur] ? spend / (ms.paidCount[cur] ?? 1) : null;
  const prevAvgCost = ps.paidCount[cur] ? (ps.spend[cur] ?? 0) / (ps.paidCount[cur] ?? 1) : null;
  const contacted = rows.filter((r) => r.indicator).length;
  const replied = rows.filter((r) => r.indicator === "replied").length;

  // 6 месяцев для графиков
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const series = months.map((m) => ({ m, s: monthStats(rows, m, commStart) }));

  const broken = rows.filter((r) => ["missing", "nofollow", "noindex", "anchor"].includes(r.link_status));
  const guaranteeSoon = rows.filter((r) => {
    const d = daysLeft(r.guarantee_until);
    return d != null && d >= 0 && d <= 7;
  });

  // Прогноз публикаций на конец месяца по текущему темпу
  const today = new Date();
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const forecast = month === now && today.getDate() > 2 ? Math.round((ms.published / today.getDate()) * dim) : null;
  // Обязательства: погодили, но ещё не оплатили
  const owedAll = rows.filter((r) => payState(r) === "due" && (r.gp_currency || "USD") === cur).reduce((a, r) => a + realCost(r), 0);
  // Маржа месяца по опубликованным с ценой для клиента
  const pubWithClient = rows.filter((r) => r.core_status === "Published" && (r.published_at ?? "").slice(0, 7) === month && r.client_price != null && (r.gp_currency || "USD") === cur);
  const margin = pubWithClient.reduce((a, r) => a + (r.client_price ?? 0) - realCost(r), 0);
  const marginCount = pubWithClient.length;
  // Воронка: сколько доноров на каждом этапе и сколько дошли до этапа
  const coreRows = rows.filter((r) => r.fg_status === "core");
  const stageCount = new Map<string, number>();
  for (const r of coreRows) {
    const st = stageOf(r);
    stageCount.set(st, (stageCount.get(st) ?? 0) + 1);
  }
  const reached = STAGES.map((_, k) => STAGES.slice(k).reduce((a, st) => a + (stageCount.get(st) ?? 0), 0));
  const reachedMax = Math.max(1, ...STAGES.map((st) => stageCount.get(st) ?? 0));
  const dropCounts = new Map<string, number>();
  for (const r of rows) {
    if (CORE_NEG.includes(r.core_status)) dropCounts.set(r.core_status, (dropCounts.get(r.core_status) ?? 0) + 1);
    if (r.fg_status === "out") dropCounts.set("Out Geo/Topics", (dropCounts.get("Out Geo/Topics") ?? 0) + 1);
  }
  const dropData = [...dropCounts.entries()].sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value }));
  const att = attention(rows).filter((a) => a.list.length > 0);

  const qs = (over: { project?: string; tab?: string; m?: string }) => {
    const p = new URLSearchParams();
    const pr = over.project ?? scope;
    const tb = over.tab ?? tab;
    const mo = over.m ?? month;
    if (pr !== "all") p.set("project", pr);
    if (tb !== "overview") p.set("tab", tb);
    if (mo !== now) p.set("m", mo);
    const s = p.toString();
    return "/app" + (s ? `?${s}` : "");
  };
  const money = (n: number) => fa(n, cur);

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка: период и проект */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">{t("nav.dashboard")}</h1>
          <p className="mt-1 text-mute">
            {scope === "all" ? t("dash.allOfTeam", { name: team.name }) : pById.get(scope)?.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/app" className="flex items-center gap-1">
            {tab !== "overview" && <input type="hidden" name="tab" value={tab} />}
            {month !== now && <input type="hidden" name="m" value={month} />}
            <label htmlFor="dash-project" className="sr-only">{t("common.project")}</label>
            <select id="dash-project" name="project" defaultValue={scope === "all" ? "" : scope} className="inp w-auto">
              <option value="">{t("dash.allProjects")}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="submit" className="btn btn-sm">{t("common.show")}</button>
          </form>
          <div className="flex items-center gap-1">
            <Link href={qs({ m: prev })} className="btn btn-sm" aria-label={t("dash.prevMonth")}>←</Link>
            <span className="min-w-36 text-center font-medium capitalize">{ml(month)}</span>
            {month < now ? (
              <Link href={qs({ m: shiftMonth(month, 1) })} className="btn btn-sm" aria-label={t("dash.nextMonth")}>→</Link>
            ) : (
              <span className="btn btn-sm opacity-40" aria-hidden="true">→</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tb) => (
          <Link key={tb.key} href={qs({ tab: tb.key })} className={`tab whitespace-nowrap ${tab === tb.key ? "tab-on" : ""}`}>
            {t(tb.label)}
            {tb.key === "links" && broken.length > 0 && <span className="pill pill-bad ml-1">{broken.length}</span>}
          </Link>
        ))}
      </div>

      {/* ---------------- ОГЛЯД: план → процес → що робити → динаміка ---------------- */}
      {tab === "overview" && (
        <>
          {/* 1. План місяця */}
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="card flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="lbl">{t("dash.planPubs")}</p>
                {(() => {
                  const d = delta(ms.published, ps.published);
                  return d != null && Number.isFinite(d) && d !== 0 ? (
                    <span className={`pill ${d > 0 ? "pill-ok" : "pill-bad"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d))}% {t("dash.vsPrev")}</span>
                  ) : null;
                })()}
              </div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                {ms.published}
                {plan > 0 && <span className="text-lg font-normal text-mute"> / {plan}</span>}
              </p>
              {plan > 0 ? <Progress value={ms.published} max={plan} /> : <p className="text-sm text-mute">{t("dash.noPlan")}</p>}
              <p className="text-sm text-mute" suppressHydrationWarning>
                {plan > 0 && <>{t("dash.ofPlan", { p: pctTxt(rate(ms.published, plan)) })}</>}
                {forecast != null && <> · {t("dash.forecast", { n: forecast })}</>}
              </p>
            </div>
            <div className="card flex flex-col gap-2">
              <p className="lbl">{t("dash.planBudget", { cur })}</p>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                {money(spend)}
                {budget > 0 && <span className="text-lg font-normal text-mute"> / {money(budget)}</span>}
              </p>
              {budget > 0 ? (
                <>
                  <Progress value={spend + owedAll} max={budget} warnOver />
                  <p className={`text-sm ${budget - spend - owedAll < 0 ? "text-bad" : "text-mute"}`}>
                    {budget - spend - owedAll >= 0 ? t("dash.left", { x: money(budget - spend - owedAll) }) : t("dash.over", { x: money(spend + owedAll - budget) })} ·{" "}
                    {t("dash.owed", { x: money(owedAll) })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-mute">{t("dash.noBudget")}</p>
              )}
            </div>
          </section>

          {/* 2. Ключові показники — лише 4 */}
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label={t("dash.avgCost")} value={avgCost == null ? "—" : money(avgCost)} sub={t("dash.withCommission")} vs={t("dash.vsPrev")} delta={delta(avgCost, prevAvgCost)} goodWhenUp={false} />
            <Kpi label={t("dash.marginMonth")} value={marginCount ? money(margin) : "—"} sub={marginCount ? t("dash.marginOf", { n: marginCount }) : t("dash.marginHint")} />
            <Kpi label={t("dash.timeToPublish")} value={daysTxt(avg(ms.days))} sub={t("dash.fromFirstContact")} vs={t("dash.vsPrev")} delta={delta(avg(ms.days), avg(ps.days))} goodWhenUp={false} />
            <Kpi label={t("dash.replyRate")} value={pctTxt(rate(replied, contacted))} sub={t("dash.ofLetters", { a: replied, b: contacted })} />
          </section>

          {/* 3. Процес і що робити */}
          <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
            <section className="card">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="lbl">{t("dash.process")}</p>
                <span className="text-xs text-mute">{t("dash.processHint")}</span>
              </div>
              <ol className="flex flex-col gap-1.5">
                {STAGES.map((st, k) => {
                  const n = stageCount.get(st) ?? 0;
                  const conv = k > 0 && reached[k - 1] ? Math.round((reached[k] / reached[k - 1]) * 100) : null;
                  return (
                    <li key={st} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
                      <span className="truncate">{t(STAGE_KEY[st])}</span>
                      <span className="h-2 overflow-hidden rounded bg-bg">
                        <span className="block h-full rounded bg-accent" style={{ width: `${reachedMax ? (n / reachedMax) * 100 : 0}%` }} />
                      </span>
                      <span className="w-20 text-right font-mono tabular-nums">
                        {n}
                        {conv != null && <span className="ml-1 text-xs text-mute">{conv}%</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {dropData.length > 0 && (
                <details className="mt-3 border-t border-line pt-2 text-sm">
                  <summary className="cursor-pointer text-mute">{t("dash.dropReasons")} · {dropData.reduce((a, d) => a + d.value, 0)}</summary>
                  <div className="mt-2"><HBars data={dropData} format={(n) => String(n)} tone={() => "var(--mute)"} /></div>
                </details>
              )}
            </section>

            <section className="card">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="lbl">{t("dash.attention")}</p>
                <Link href="/app/today" className="text-sm underline">{t("dash.allTasks")}</Link>
              </div>
              {att.length === 0 ? (
                <p className="text-sm text-mute">{t("today.clear")}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {att.map((a) => (
                    <li key={a.key}>
                      <Link href={`/app/today#${a.key}`} className="flex items-center gap-2 py-2">
                        <span className={`pill ${ATT_TONE[a.key]}`}>{a.list.length}</span>
                        <span className="min-w-0 flex-1 truncate">{t(ATT_TITLE[a.key])}</span>
                        <span className="text-mute" aria-hidden="true">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 4. Динаміка */}
          <details className="card" open>
            <summary className="cursor-pointer list-none lbl">{t("dash.dynamics")} ▾</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{t("dash.pubs6")}</p>
                  {plan > 0 && <span className="text-xs text-mute">{t("dash.planLine", { n: plan })}</span>}
                </div>
                <MonthBars
                  data={series.map(({ m, s }) => ({ label: ml(m, "short"), value: s.published, hint: t("dash.pubsHint", { m: ml(m), n: s.published }) }))}
                  target={plan || null}
                  targetLabel={t("dash.plan")}
                  format={(n) => String(Math.round(n))}
                />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{t("dash.spend6", { cur })}</p>
                  {budget > 0 && <span className="text-xs text-mute">{t("dash.budgetLine", { b: money(budget) })}</span>}
                </div>
                <MonthBars
                  data={series.map(({ m, s }) => ({ label: ml(m, "short"), value: s.spend[cur] ?? 0, hint: `${ml(m)}: ${money(s.spend[cur] ?? 0)}` }))}
                  target={budget || null}
                  targetLabel={t("dash.budget")}
                  format={(n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)))}
                />
              </div>
            </div>
          </details>
        </>
      )}

      {/* ---------------- ПРОЄКТИ ---------------- */}
      {tab === "projects" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {[t("common.project"), t("dash.planFact"), "", t("dash.budgetSpent"), "", t("dash.avgShort"), t("dash.talks"), "Guest Posting", t("dash.problems"), ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const pr = all.filter((r) => r.project_id === p.id);
                const st = monthStats(pr, month, commStart);
                const c = (p.budget_currency || "USD") as Cur;
                const spent = st.spend[c] ?? 0;
                const ac = st.paidCount[c] ? spent / (st.paidCount[c] ?? 1) : null;
                const probs = pr.filter((r) => ["missing", "nofollow", "noindex", "anchor"].includes(r.link_status)).length;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold">{p.name}</span>
                      {p.niche && <span className="pill ml-1">{p.niche}</span>}
                    </td>
                    <td className="font-mono whitespace-nowrap">{st.published} / {p.plan_per_month}</td>
                    <td className="min-w-24"><Progress value={st.published} max={p.plan_per_month} /></td>
                    <td className="font-mono whitespace-nowrap">
                      {p.monthly_budget ? `${fa(spent, c)} / ${fa(p.monthly_budget, c)}` : <span className="text-mute">—</span>}
                    </td>
                    <td className="min-w-24">{p.monthly_budget ? <Progress value={spent} max={p.monthly_budget} warnOver /> : null}</td>
                    <td className="font-mono">{ac == null ? "—" : fa(ac, c)}</td>
                    <td className="font-mono">{pr.filter((r) => r.in_comm && !r.in_gp).length}</td>
                    <td className="font-mono">{pr.filter((r) => r.in_gp && r.core_status !== "Published").length}</td>
                    <td>{probs ? <span className="pill pill-bad">{probs}</span> : <span className="text-mute">—</span>}</td>
                    <td><Link href={`/app/projects/${p.id}`} className="btn btn-sm">{t("common.open")}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- БЮДЖЕТИ ---------------- */}
      {tab === "budgets" && (
        <>
          <p className="text-sm text-mute">
            {t("dash.budgetsLead", { m: ml(month) })}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => {
              const pr = all.filter((r) => r.project_id === p.id);
              const c = (p.budget_currency || "USD") as Cur;
              const st = monthStats(pr, month, commStart);
              const spent = st.spend[c] ?? 0;
              const owed = pr.filter((r) => payState(r) === "due" && r.gp_currency === c).reduce((a, r) => a + realCost(r), 0);
              const b = p.monthly_budget ?? 0;
              const left = b - spent - owed;
              return (
                <section key={p.id} className="card flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/app/projects/${p.id}`} className="truncate font-semibold underline">{p.name}</Link>
                    {p.niche && <span className="pill">{p.niche}</span>}
                  </div>
                  {b > 0 ? (
                    <>
                      <p className="font-mono text-2xl font-semibold tabular-nums">
                        {fa(spent, c)} <span className="text-base font-normal text-mute">/ {fa(b, c)}</span>
                      </p>
                      <div className="flex flex-col gap-1.5 text-sm">
                        <div className="flex justify-between"><span>{t("dash.spentWord")}</span><span className="font-mono">{pctTxt(rate(spent, b))}</span></div>
                        <Progress value={spent} max={b} warnOver />
                        <div className="flex justify-between"><span>{t("dash.withOwed")}</span><span className="font-mono">{pctTxt(rate(spent + owed, b))}</span></div>
                        <Progress value={spent + owed} max={b} warnOver />
                      </div>
                      <p className={`text-sm ${left < 0 ? "text-bad" : "text-mute"}`}>
                        {left >= 0 ? t("dash.left", { x: fa(left, c) }) : t("dash.over", { x: fa(-left, c) })} · {t("dash.owed", { x: fa(owed, c) })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-mute">
                      {t("dash.noBudgetDot")}{" "}
                      {isLead && <Link href={`/app/projects/${p.id}?tab=profile`} className="underline">{t("dash.setInProfile")}</Link>}
                      {spent > 0 && <> {t("dash.spentThisMonth", { x: fa(spent, c) })}</>}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- КОМАНДА ---------------- */}
      {tab === "team" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {[t("common.builder"), t("dash.inCore"), t("dash.talks"), t("dash.reply"), t("dash.agreed"), `${t("core.published")} (${ml(month, "short")})`, t("dash.timeToPublish"), t("dash.spentWord")].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...members.map((m) => ({ id: m.id as string | null, name: m.name })), { id: null, name: t("common.withoutAssignee") }].map((m) => {
                const mr = rows.filter((r) => r.assignee === m.id);
                if (m.id === null && mr.length === 0) return null;
                const st = monthStats(mr, month, commStart);
                const con = mr.filter((r) => r.indicator).length;
                const rep = mr.filter((r) => r.indicator === "replied").length;
                return (
                  <tr key={m.id ?? "none"}>
                    <td className="whitespace-nowrap font-medium">{m.name}</td>
                    <td className="font-mono">{mr.filter((r) => r.fg_status === "core").length}</td>
                    <td className="font-mono">{mr.filter((r) => r.in_comm && !r.in_gp).length}</td>
                    <td className="font-mono">{pctTxt(rate(rep, con))}</td>
                    <td className="font-mono">{mr.filter((r) => r.comm_status === "Accepted").length}</td>
                    <td className="font-mono">{st.published}</td>
                    <td className="font-mono">{daysTxt(avg(st.days))}</td>
                    <td className="font-mono">{fm(st.spend)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- ПОСИЛАННЯ ---------------- */}
      {tab === "links" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="card">
            <p className="lbl mb-3">{t("dash.linkState")}</p>
            {(() => {
              const withUrl = rows.filter((r) => r.in_gp && r.link_status);
              const order: LinkStatus[] = ["ok", "missing", "nofollow", "noindex", "anchor", "blocked", "error"];
              const data = order
                .map((k) => ({ label: t(LINK_STATUS[k].key), value: withUrl.filter((r) => r.link_status === k).length }))
                .filter((d) => d.value > 0);
              const toneOf = (label: string) => {
                const k = order.find((x) => t(LINK_STATUS[x].key) === label);
                const tn = k ? LINK_STATUS[k].tone : "";
                return tn === "ok" ? "var(--ok)" : tn === "bad" ? "var(--bad)" : tn === "warn" ? "var(--warn)" : "var(--mute)";
              };
              return data.length ? (
                <HBars data={data} format={(n) => String(n)} tone={toneOf} />
              ) : (
                <p className="text-sm text-mute">{t("dash.noChecked")}</p>
              );
            })()}
          </section>
          <section className="card">
            <p className="lbl mb-3">{t("dash.guarantee7")}</p>
            {guaranteeSoon.length === 0 ? (
              <p className="text-sm text-mute">{t("common.none")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {guaranteeSoon.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <Link href={`/app/projects/${r.project_id}?tab=work`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                    <span className="pill">{pById.get(r.project_id)?.name}</span>
                    <span className="pill pill-warn" suppressHydrationWarning>{t("unit.days", { n: daysLeft(r.guarantee_until) ?? 0 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card lg:col-span-2">
            <p className="lbl mb-3">{t("dash.brokenLinks")} · {broken.length}</p>
            {broken.length === 0 ? (
              <p className="text-sm text-mute">{t("dash.allOk")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {broken.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <Link href={`/app/projects/${r.project_id}?tab=work`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                    <span className="pill">{pById.get(r.project_id)?.name}</span>
                    <span className="pill pill-bad">{LINK_STATUS[r.link_status as LinkStatus] ? t(LINK_STATUS[r.link_status as LinkStatus].key) : r.link_status}</span>
                    {(daysLeft(r.guarantee_until) ?? -1) >= 0 && <span className="pill pill-warn">{t("dash.hasGuarantee")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
