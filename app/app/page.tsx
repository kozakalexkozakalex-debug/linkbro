import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll } from "@/lib/fetchAll";
import { hoursSince, isThisMonth, LINK_STATUS, type LinkStatus } from "@/lib/project";
import { addTo, daysLeft, fmtAmount, fmtMoney, payState, realCost, type ByCurrency } from "@/lib/money";

type Search = Promise<{ project?: string }>;

type Row = {
  id: string;
  project_id: string;
  domain: string;
  assignee: string | null;
  fg_status: string;
  core_status: string;
  published_at: string | null;
  in_comm: boolean;
  in_gp: boolean;
  gp_status: string;
  gp_price: number | null;
  indicator: string | null;
  indicator_at: string | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  paid_at: string | null;
  link_status: LinkStatus;
  guarantee_until: string | null;
};

type Stats = { fromG: number; core: number; comm: number; gp: number; pub: number; paid: ByCurrency; due: ByCurrency; paidMonth: ByCurrency };

function stats(rows: Row[]): Stats {
  const s: Stats = { fromG: rows.length, core: 0, comm: 0, gp: 0, pub: 0, paid: {}, due: {}, paidMonth: {} };
  for (const r of rows) {
    if (r.fg_status === "core") s.core++;
    if (r.in_comm) s.comm++;
    if (r.in_gp) s.gp++;
    if (r.core_status === "Published" && isThisMonth(r.published_at)) s.pub++;
    const st = payState(r);
    if (st === "paid") {
      addTo(s.paid, r.gp_currency, realCost(r));
      if (isThisMonth(r.paid_at)) addTo(s.paidMonth, r.gp_currency, realCost(r));
    }
    else if (st === "due") addTo(s.due, r.gp_currency, realCost(r));
  }
  return s;
}

const money = (m: ByCurrency) => fmtMoney(m);
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2.5 min-w-16 overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();

  const { data: pData } = await supabase.from("projects")
    .select("id, name, niche, plan_per_month, monthly_budget, budget_currency")
    .eq("team_id", team.id)
    .order("created_at");
  const projects = (pData ?? []) as {
    id: string;
    name: string;
    niche: string;
    plan_per_month: number;
    monthly_budget: number | null;
    budget_currency: string;
  }[];
  const scope = projects.some((p) => p.id === sp.project) ? (sp.project as string) : "all";

  const all = await fetchAll<Row>((from, to) =>
    supabase
      .from("project_donors")
      .select("id, project_id, domain, assignee, fg_status, core_status, published_at, in_comm, in_gp, gp_status, gp_price, indicator, indicator_at, gp_currency, gp_commission, pay_status, paid_at, link_status, guarantee_until")
      .eq("team_id", team.id)
      .order("id")
      .range(from, to),
  );
  const members = await loadMembers(supabase, team.id);

  const rows = scope === "all" ? all : all.filter((r) => r.project_id === scope);
  const shownProjects = scope === "all" ? projects : projects.filter((p) => p.id === scope);
  const s = stats(rows);
  const plan = shownProjects.reduce((a, p) => a + p.plan_per_month, 0);
  const month = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", month: "long", year: "numeric" }).format(new Date());
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  const stale = rows.filter((r) => r.indicator === "waiting" && (hoursSince(r.indicator_at) ?? 0) > 72);
  const broken = rows.filter((r) => ["missing", "nofollow", "noindex", "anchor"].includes(r.link_status));
  const guaranteeSoon = rows.filter((r) => {
    const d = daysLeft(r.guarantee_until);
    return d != null && d >= 0 && d <= 7;
  });
  const funnel: [string, number][] = [
    ["From Global", s.fromG],
    ["Project Core", s.core],
    ["Communication", s.comm],
    ["Guest Posting", s.gp],
    ["Опубліковано", s.pub],
  ];
  const fmax = Math.max(1, s.fromG);

  if (projects.length === 0) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-xl font-medium">Дашборд</h1>
        <div className="card flex flex-col gap-3">
          <p>Команда «{team.name}» готова. Почніть з двох кроків:</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/input" className="btn btn-pri">Додати донорів</Link>
            {team.role === "lead" && <Link href="/app/projects/new" className="btn">Створити проєкт</Link>}
            {team.role === "lead" && <Link href="/app/team" className="btn">Запросити лінкбілдера</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-medium">Дашборд</h1>
        <p className="mt-1 text-mute">Команда «{team.name}» · {month}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        <Link href="/app" className={`tab whitespace-nowrap ${scope === "all" ? "tab-on" : ""}`}>Усі проєкти</Link>
        {projects.map((p) => (
          <Link key={p.id} href={`/app?project=${p.id}`} className={`tab whitespace-nowrap ${scope === p.id ? "tab-on" : ""}`}>
            {p.name}
          </Link>
        ))}
      </div>

      <section className="card">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="lbl">План на місяць</p>
          <p>
            Опубліковано <b className="font-mono">{s.pub} / {plan}</b>{" "}
            <span className="font-mono text-mute">{pct(s.pub, plan)}%</span>
          </p>
        </div>
        <Bar value={pct(s.pub, plan)} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [money(s.paid), "оплачено"],
          [money(s.due), "до оплати (Guest Posting)"],
          [String(s.comm - s.gp), "у переписці"],
          [String(stale.length + broken.length), "потребують уваги"],
        ].map(([v, l]) => (
          <div key={l} className="card">
            <p className="font-mono text-2xl font-semibold">{v}</p>
            <p className="text-xs text-mute">{l}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <p className="lbl mb-3">Воронка</p>
          <div className="grid grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-x-3 gap-y-2 text-sm">
            {funnel.map(([label, n]) => (
              <div key={label} className="contents">
                <span>{label}</span>
                <Bar value={pct(n, fmax)} />
                <span className="text-right font-mono">{n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <p className="lbl mb-3">Потребують уваги</p>
          {broken.length > 0 && (
            <ul className="mb-3 divide-y divide-line text-sm">
              {broken.slice(0, 12).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/app/projects/${r.project_id}?tab=gp`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                  <span className="pill">{pName.get(r.project_id)}</span>
                  <span className="pill pill-bad">{LINK_STATUS[r.link_status].label}</span>
                </li>
              ))}
            </ul>
          )}
          {guaranteeSoon.length > 0 && (
            <p className="mb-3 text-sm">
              <Link href="/app/finance" className="underline">Гарантія закінчується за 7 днів: {guaranteeSoon.length}</Link>
            </p>
          )}
          {stale.length === 0 ? (
            <p className="text-mute">{broken.length === 0 ? "Завислих переписок і проблемних посилань немає." : "Завислих переписок немає."}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {stale.slice(0, 12).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/app/projects/${r.project_id}?tab=comm`} className="min-w-0 flex-1 truncate font-mono underline">{r.domain}</Link>
                  <span className="pill">{pName.get(r.project_id)}</span>
                  <span className="pill pill-bad" suppressHydrationWarning>
                    {Math.round((hoursSince(r.indicator_at) ?? 0) / 24)} дн
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <p className="lbl mb-2">Звіт за {month} по проєктах</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Проєкт", "План", "Опубліковано", "Виконання", "Бюджет місяця", "Core", "Communication", "Guest Posting", "Оплачено", "До оплати", ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownProjects.map((p) => {
                const x = stats(all.filter((r) => r.project_id === p.id));
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold">{p.name}</span>
                      {p.niche && <span className="pill ml-1">{p.niche}</span>}
                    </td>
                    <td className="font-mono">{p.plan_per_month}</td>
                    <td className="font-mono">{x.pub}</td>
                    <td className="min-w-24"><Bar value={pct(x.pub, p.plan_per_month)} /></td>
                    <td className="min-w-32">
                      {p.monthly_budget ? (
                        <>
                          <span className="font-mono text-xs">
                            {fmtAmount(x.paidMonth[p.budget_currency as keyof ByCurrency] ?? 0, p.budget_currency)} /{" "}
                            {fmtAmount(p.monthly_budget, p.budget_currency)}
                          </span>
                          <Bar value={pct(x.paidMonth[p.budget_currency as keyof ByCurrency] ?? 0, p.monthly_budget)} />
                        </>
                      ) : (
                        <span className="text-mute">—</span>
                      )}
                    </td>
                    <td className="font-mono">{x.core}</td>
                    <td className="font-mono">{x.comm}</td>
                    <td className="font-mono">{x.gp}</td>
                    <td className="font-mono">{money(x.paid)}</td>
                    <td className="font-mono">{money(x.due)}</td>
                    <td><Link href={`/app/projects/${p.id}`} className="btn btn-sm">Відкрити</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <p className="lbl mb-2">По лінкбілдерах</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Лінкбілдер", "Донорів у Core", "У переписці", "Guest Posting", "Опубліковано за місяць", "Оплачено"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...members.map((m) => ({ id: m.id as string | null, name: m.name })), { id: null, name: "Без відповідального" }].map((m) => {
                const x = stats(rows.filter((r) => r.assignee === m.id));
                if (m.id === null && x.core === 0) return null;
                return (
                  <tr key={m.id ?? "none"}>
                    <td className="whitespace-nowrap">{m.name}</td>
                    <td className="font-mono">{x.core}</td>
                    <td className="font-mono">{x.comm - x.gp}</td>
                    <td className="font-mono">{x.gp}</td>
                    <td className="font-mono">{x.pub}</td>
                    <td className="font-mono">{money(x.paid)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
