import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll } from "@/lib/fetchAll";
import { CORE_NEG, LINK_STATUS, hoursSince, type LinkStatus } from "@/lib/project";
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

type Search = Promise<{ project?: string; tab?: string; m?: string }>;
type ProjectRow = {
  id: string;
  name: string;
  niche: string;
  plan_per_month: number;
  monthly_budget: number | null;
  budget_currency: string;
};

const TABS = [
  { key: "overview", label: "Огляд" },
  { key: "projects", label: "Проєкти" },
  { key: "budgets", label: "Бюджети" },
  { key: "team", label: "Команда" },
  { key: "links", label: "Посилання" },
] as const;

const pctTxt = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const daysTxt = (n: number | null) => (n == null ? "—" : `${Math.round(n * 10) / 10} дн`);
type Cur = "USD" | "EUR" | "UAH";

export default async function Dashboard({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
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
        <h1 className="font-display text-xl font-medium">Дашборд</h1>
        <div className="card flex flex-col gap-3">
          <p>Команда «{team.name}» готова. Почніть з двох кроків:</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/input" className="btn btn-pri">Додати донорів</Link>
            {isLead && <Link href="/app/projects/new" className="btn">Створити проєкт</Link>}
            {isLead && <Link href="/app/team" className="btn">Запросити лінкбілдера</Link>}
          </div>
        </div>
      </div>
    );
  }

  const scope = projects.some((p) => p.id === sp.project) ? (sp.project as string) : "all";
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "overview";
  const now = currentMonth();
  const month = isValidMonth(sp.m) && sp.m <= now ? sp.m : now;
  const prev = shiftMonth(month, -1);

  const all = await fetchAll<AnRow>((from, to) =>
    supabase.from("project_donors").select(AN_COLUMNS).eq("team_id", team.id).order("id").range(from, to),
  );
  const log = await fetchAll<{ donor_id: string | null; created_at: string }>((from, to) =>
    supabase
      .from("activity_log")
      .select("donor_id, created_at")
      .eq("team_id", team.id)
      .eq("field", "core_status")
      .eq("new_value", "In communication")
      .order("created_at")
      .range(from, to),
  );
  const commStart = new Map<string, string>();
  for (const l of log) if (l.donor_id && !commStart.has(l.donor_id)) commStart.set(l.donor_id, l.created_at);

  const members = await loadMembers(supabase, team.id);
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
  const talked = rows.filter((r) => r.comm_status).length;
  const accepted = rows.filter((r) => r.comm_status === "Accepted").length;
  const due: ByCurrency = {};
  for (const r of rows) if (payState(r) === "due") addTo(due, r.gp_currency, realCost(r));

  // 6 месяцев для графиков
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const series = months.map((m) => ({ m, s: monthStats(rows, m, commStart) }));

  const stale = rows.filter((r) => r.indicator === "waiting" && (hoursSince(r.indicator_at) ?? 0) > 72);
  const broken = rows.filter((r) => ["missing", "nofollow", "noindex", "anchor"].includes(r.link_status));
  const guaranteeSoon = rows.filter((r) => {
    const d = daysLeft(r.guarantee_until);
    return d != null && d >= 0 && d <= 7;
  });

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
  const money = (n: number) => fmtAmount(n, cur);

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка: период и проект */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">Дашборд</h1>
          <p className="mt-1 text-mute">
            {scope === "all" ? `Усі проєкти команди «${team.name}»` : pById.get(scope)?.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/app" className="flex items-center gap-1">
            {tab !== "overview" && <input type="hidden" name="tab" value={tab} />}
            {month !== now && <input type="hidden" name="m" value={month} />}
            <label htmlFor="dash-project" className="sr-only">Проєкт</label>
            <select id="dash-project" name="project" defaultValue={scope === "all" ? "" : scope} className="inp w-auto">
              <option value="">Усі проєкти</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="submit" className="btn btn-sm">Показати</button>
          </form>
          <div className="flex items-center gap-1">
            <Link href={qs({ m: prev })} className="btn btn-sm" aria-label="Попередній місяць">←</Link>
            <span className="min-w-36 text-center font-medium capitalize">{monthLabel(month)}</span>
            {month < now ? (
              <Link href={qs({ m: shiftMonth(month, 1) })} className="btn btn-sm" aria-label="Наступний місяць">→</Link>
            ) : (
              <span className="btn btn-sm opacity-40" aria-hidden="true">→</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={qs({ tab: t.key })} className={`tab whitespace-nowrap ${tab === t.key ? "tab-on" : ""}`}>
            {t.label}
            {t.key === "links" && broken.length > 0 && <span className="pill pill-bad ml-1">{broken.length}</span>}
          </Link>
        ))}
      </div>

      {/* ---------------- ОГЛЯД ---------------- */}
      {tab === "overview" && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi
              label="Опубліковано"
              value={plan ? `${ms.published} / ${plan}` : String(ms.published)}
              sub={plan ? `${pctTxt(rate(ms.published, plan))} плану` : "план не задано"}
              delta={delta(ms.published, ps.published)}
            />
            <Kpi
              label={`Витрачено (${cur})`}
              value={money(spend)}
              sub={budget ? `з бюджету ${money(budget)} · ${pctTxt(rate(spend, budget))}` : "бюджет не задано"}
              delta={delta(spend, ps.spend[cur] ?? 0)}
              goodWhenUp={false}
            />
            <Kpi
              label="Середня ціна посилання"
              value={avgCost == null ? "—" : money(avgCost)}
              sub="з комісією біржі"
              delta={delta(avgCost, prevAvgCost)}
              goodWhenUp={false}
            />
            <Kpi
              label="Час до публікації"
              value={daysTxt(avg(ms.days))}
              sub="від початку переписки"
              delta={delta(avg(ms.days), avg(ps.days))}
              goodWhenUp={false}
            />
            <Kpi label="Відповідають посередники" value={pctTxt(rate(replied, contacted))} sub={`${replied} з ${contacted} листів`} />
            <Kpi label="Погоджуються" value={pctTxt(rate(accepted, talked))} sub={`${accepted} з ${talked} переписок · до оплати ${fmtMoney(due)}`} />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="card">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="lbl">Публікації за 6 місяців</p>
                {plan > 0 && <span className="text-xs text-mute">пунктир — план {plan}/міс.</span>}
              </div>
              <MonthBars
                data={series.map(({ m, s }) => ({ label: monthLabel(m, "short"), value: s.published, hint: `${monthLabel(m)}: ${s.published} публікацій` }))}
                target={plan || null}
                targetLabel="план"
                format={(n) => String(Math.round(n))}
              />
            </section>
            <section className="card">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="lbl">Витрати за 6 місяців, {cur}</p>
                {budget > 0 && <span className="text-xs text-mute">пунктир — бюджет {money(budget)}/міс.</span>}
              </div>
              <MonthBars
                data={series.map(({ m, s }) => ({ label: monthLabel(m, "short"), value: s.spend[cur] ?? 0, hint: `${monthLabel(m)}: ${money(s.spend[cur] ?? 0)}` }))}
                target={budget || null}
                targetLabel="бюджет"
                format={(n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)))}
              />
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <section className="card">
              <p className="lbl mb-3">Воронка зараз</p>
              <HBars
                data={[
                  { label: "From Global", value: rows.length },
                  { label: "Project Core", value: rows.filter((r) => r.fg_status === "core").length },
                  { label: "Communication", value: rows.filter((r) => r.in_comm).length },
                  { label: "Guest Posting", value: rows.filter((r) => r.in_gp).length },
                  { label: "Опубліковано", value: rows.filter((r) => r.core_status === "Published").length },
                ]}
                format={(n) => String(n)}
              />
            </section>
            <section className="card">
              <p className="lbl mb-3">Причини відсіву</p>
              {(() => {
                const counts = new Map<string, number>();
                for (const r of rows) {
                  if (CORE_NEG.includes(r.core_status)) counts.set(r.core_status, (counts.get(r.core_status) ?? 0) + 1);
                  if (r.fg_status === "out") counts.set("Out Geo/Topics", (counts.get("Out Geo/Topics") ?? 0) + 1);
                  if (r.comm_status === "Declined" || r.comm_status === "No Response")
                    counts.set(r.comm_status, (counts.get(r.comm_status) ?? 0) + 1);
                }
                const data = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
                return data.length ? (
                  <HBars data={data} format={(n) => String(n)} tone={() => "var(--mute)"} />
                ) : (
                  <p className="text-sm text-mute">Відсіяних донорів поки немає.</p>
                );
              })()}
            </section>
            <section className="card">
              <p className="lbl mb-3">Потребують уваги</p>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <Link href={qs({ tab: "links" })} className="underline">Проблемні посилання</Link>
                  <span className={`pill ${broken.length ? "pill-bad" : "pill-ok"}`}>{broken.length}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>Без відповіді понад 3 дні</span>
                  <span className={`pill ${stale.length ? "pill-warn" : "pill-ok"}`}>{stale.length}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <Link href="/app/finance" className="underline">Гарантія спливає за 7 днів</Link>
                  <span className={`pill ${guaranteeSoon.length ? "pill-warn" : "pill-ok"}`}>{guaranteeSoon.length}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <Link href="/app/finance" className="underline">До оплати</Link>
                  <span className="pill">{fmtMoney(due)}</span>
                </li>
              </ul>
              {stale.length > 0 && (
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {stale.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex items-center gap-2 py-1.5">
                      <Link href={`/app/projects/${r.project_id}?tab=comm`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                      <span className="pill" suppressHydrationWarning>{Math.round((hoursSince(r.indicator_at) ?? 0) / 24)} дн</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* ---------------- ПРОЄКТИ ---------------- */}
      {tab === "projects" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Проєкт", "План / факт", "", "Бюджет / витрачено", "", "Сер. ціна", "Переписка", "Guest Posting", "Проблеми", ""].map((h, i) => (
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
                      {p.monthly_budget ? `${fmtAmount(spent, c)} / ${fmtAmount(p.monthly_budget, c)}` : <span className="text-mute">—</span>}
                    </td>
                    <td className="min-w-24">{p.monthly_budget ? <Progress value={spent} max={p.monthly_budget} warnOver /> : null}</td>
                    <td className="font-mono">{ac == null ? "—" : fmtAmount(ac, c)}</td>
                    <td className="font-mono">{pr.filter((r) => r.in_comm && !r.in_gp).length}</td>
                    <td className="font-mono">{pr.filter((r) => r.in_gp && r.core_status !== "Published").length}</td>
                    <td>{probs ? <span className="pill pill-bad">{probs}</span> : <span className="text-mute">—</span>}</td>
                    <td><Link href={`/app/projects/${p.id}`} className="btn btn-sm">Відкрити</Link></td>
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
            Витрачено — оплачені за {monthLabel(month)} посилання з комісією. Зобов&apos;язання — погоджені, але ще не оплачені. Бюджет
            задається в профілі проєкту.
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
                        {fmtAmount(spent, c)} <span className="text-base font-normal text-mute">/ {fmtAmount(b, c)}</span>
                      </p>
                      <div className="flex flex-col gap-1.5 text-sm">
                        <div className="flex justify-between"><span>Витрачено</span><span className="font-mono">{pctTxt(rate(spent, b))}</span></div>
                        <Progress value={spent} max={b} warnOver />
                        <div className="flex justify-between"><span>З урахуванням зобов&apos;язань</span><span className="font-mono">{pctTxt(rate(spent + owed, b))}</span></div>
                        <Progress value={spent + owed} max={b} warnOver />
                      </div>
                      <p className={`text-sm ${left < 0 ? "text-bad" : "text-mute"}`}>
                        {left >= 0 ? `Залишок: ${fmtAmount(left, c)}` : `Перевищення: ${fmtAmount(-left, c)}`} · зобов&apos;язання {fmtAmount(owed, c)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-mute">
                      Бюджет не задано.{" "}
                      {isLead && <Link href={`/app/projects/${p.id}?tab=profile`} className="underline">Задати в профілі</Link>}
                      {spent > 0 && <> Витрачено цього місяця: {fmtAmount(spent, c)}.</>}
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
                {["Лінкбілдер", "У Core", "Переписка", "Відповідь", "Погодились", `Опубліковано (${monthLabel(month, "short")})`, "Час до публікації", "Витрачено"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...members.map((m) => ({ id: m.id as string | null, name: m.name })), { id: null, name: "Без відповідального" }].map((m) => {
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
                    <td className="font-mono">{fmtMoney(st.spend)}</td>
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
            <p className="lbl mb-3">Стан опублікованих посилань</p>
            {(() => {
              const withUrl = rows.filter((r) => r.in_gp && r.link_status);
              const order: LinkStatus[] = ["ok", "missing", "nofollow", "noindex", "anchor", "blocked", "error"];
              const data = order
                .map((k) => ({ label: LINK_STATUS[k].label, value: withUrl.filter((r) => r.link_status === k).length }))
                .filter((d) => d.value > 0);
              const toneOf = (label: string) => {
                const k = order.find((x) => LINK_STATUS[x].label === label);
                const t = k ? LINK_STATUS[k].tone : "";
                return t === "ok" ? "var(--ok)" : t === "bad" ? "var(--bad)" : t === "warn" ? "var(--warn)" : "var(--mute)";
              };
              return data.length ? (
                <HBars data={data} format={(n) => String(n)} tone={toneOf} />
              ) : (
                <p className="text-sm text-mute">Ще немає перевірених посилань. Додайте Article URL у Guest Posting.</p>
              );
            })()}
          </section>
          <section className="card">
            <p className="lbl mb-3">Гарантія спливає за 7 днів</p>
            {guaranteeSoon.length === 0 ? (
              <p className="text-sm text-mute">Немає.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {guaranteeSoon.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <Link href={`/app/projects/${r.project_id}?tab=gp`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                    <span className="pill">{pById.get(r.project_id)?.name}</span>
                    <span className="pill pill-warn" suppressHydrationWarning>{daysLeft(r.guarantee_until)} дн</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card lg:col-span-2">
            <p className="lbl mb-3">Проблемні посилання · {broken.length}</p>
            {broken.length === 0 ? (
              <p className="text-sm text-mute">Усі перевірені посилання на місці.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {broken.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <Link href={`/app/projects/${r.project_id}?tab=gp`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                    <span className="pill">{pById.get(r.project_id)?.name}</span>
                    <span className="pill pill-bad">{LINK_STATUS[r.link_status as LinkStatus]?.label ?? r.link_status}</span>
                    {(daysLeft(r.guarantee_until) ?? -1) >= 0 && <span className="pill pill-warn">є гарантія</span>}
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
