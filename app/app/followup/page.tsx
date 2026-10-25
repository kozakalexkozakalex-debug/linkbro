import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { fetchAll } from "@/lib/fetchAll";
import { stageOf, STAGE_KEY } from "@/lib/stages";
import { emailOf } from "@/lib/outreach";
import ModuleHead from "@/components/ModuleHead";
import FollowUp, { type FuRow } from "./FollowUp";

// «Сьогодні» — главный экран Outreach: одна очередь дел.
// Сверху — что требует внимания: новые ответы, цена выше лимита, дедлайны статей, сделки без контакта, сломанные ссылки.
// Ниже — кому написать: за планом / мовчать N днів / ще не писали, с отправкой одного письма сразу нескольким.
type D = {
  id: string;
  project_id: string;
  domain: string;
  med_base: string;
  fg_status: string;
  stage: string | null;
  core_status: string;
  indicator: string | null;
  indicator_at: string | null;
  next_action_at: string | null;
  next_action: string;
  gp_price: number | null;
  gp_currency: string;
  anchors: string;
  page_url: string;
  article_deadline: string | null;
  article_status: string;
};
const COLS = "id, project_id, domain, med_base, fg_status, stage, core_status, indicator, indicator_at, next_action_at, next_action, gp_price, gp_currency, anchors, page_url, article_deadline, article_status";
const PROBLEMS = "(missing,nofollow,noindex,anchor)";
type QItem = { key: string; label: string; sub: string; href: string };
const DAYS = [2, 3, 5, 7, 14];

export const maxDuration = 60; // массовая проверка ссылок / рассылка — до минуты

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ d?: string; l?: string }> }) {
  const sp = await searchParams;
  const days = DAYS.includes(Number(sp.d)) ? Number(sp.d) : 3;
  const [{ supabase, team }, { t }, { projectId, projects }] = await Promise.all([getTeamContext(), getI18n(), getScope()]);

  const [deals, { data: tpl }, { data: mail }, { data: pj }, { data: unread }, { count: broken }] = await Promise.all([
    fetchAll<D>((from, to) => {
      let q = supabase.from("project_donors").select(COLS).eq("team_id", team.id).not("stage", "in", "(published,lost)");
      if (projectId) q = q.eq("project_id", projectId);
      return q.order("id").range(from, to);
    }),
    supabase.from("templates").select("id, name, body").eq("team_id", team.id).eq("kind", "message").order("name"),
    supabase.from("mail_accounts").select("email").maybeSingle(),
    supabase.from("projects").select("id, link_budget, budget_currency").eq("team_id", team.id),
    supabase.from("activities").select("handle, donor_id, donor_ids, created_at").eq("team_id", team.id).eq("is_read", false).eq("direction", "in").order("created_at", { ascending: false }).limit(300),
    (() => {
      let q = supabase.from("project_donors").select("id", { count: "exact", head: true }).eq("team_id", team.id).filter("link_status", "in", PROBLEMS);
      if (projectId) q = q.eq("project_id", projectId);
      return q;
    })(),
  ]);
  const handles = [...new Set(deals.map((d) => d.med_base.trim()).filter(Boolean))];
  const { data: cc } = handles.length
    ? await supabase.from("contacts").select("handle, email").eq("team_id", team.id).in("handle", handles.slice(0, 1000))
    : { data: [] };
  const mailOf = new Map(((cc ?? []) as { handle: string; email: string }[]).map((c) => [c.handle, c.email]));
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  const today = new Date().toISOString().slice(0, 10);
  const border = Date.now() - days * 86_400_000;
  const row = (d: D, st: ReturnType<typeof stageOf>, since: string | null): FuRow => ({
    id: d.id,
    domain: d.domain,
    project: pName.get(d.project_id) ?? "",
    handle: d.med_base.trim(),
    email: emailOf(d.med_base, mailOf.get(d.med_base.trim())),
    stage: t(STAGE_KEY[st]),
    since,
    note: d.next_action,
    fill: { domain: d.domain, anchors: d.anchors, page_url: d.page_url, gp_price: d.gp_price, gp_currency: d.gp_currency, article_deadline: d.article_deadline },
  });

  const plan: FuRow[] = [];
  const wait: FuRow[] = [];
  const first: FuRow[] = [];
  for (const d of deals) {
    const st = stageOf(d);
    if (st === "published" || st === "lost") continue;
    if (d.next_action_at && d.next_action_at <= today) plan.push(row(d, st, d.next_action_at));
    else if (st === "contacted" && (!d.indicator_at || new Date(d.indicator_at).getTime() < border)) wait.push(row(d, st, d.indicator_at));
    else if (st === "find" && d.fg_status === "core" && d.med_base.trim()) first.push(row(d, st, null));
  }
  plan.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  wait.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  first.sort((a, b) => a.handle.localeCompare(b.handle) || a.domain.localeCompare(b.domain));

  // ---------- Черга: що потребує уваги ----------
  const budgets = new Map(((pj ?? []) as { id: string; link_budget: number | null; budget_currency: string }[]).map((p) => [p.id, p]));
  const inScope = new Set(deals.map((d) => d.id));
  const open = (d: D) => (projectId ? `/app/outreach?q=${encodeURIComponent(d.domain)}` : `/app/scope?p=${d.project_id}&next=${encodeURIComponent(`/app/outreach?q=${d.domain}`)}`);
  const fmt = (n: number, c: string) => `${Math.round(n)} ${c}`;
  const queue: { key: string; title: string; items: QItem[]; tone: string }[] = [];

  // 1) Нові відповіді — по посереднику
  const replies = new Map<string, number>();
  for (const a of (unread ?? []) as { handle: string; donor_id: string | null; donor_ids: string[] | null }[]) {
    const ids = [...(a.donor_ids ?? []), ...(a.donor_id ? [a.donor_id] : [])];
    if (projectId && ids.length && !ids.some((id) => inScope.has(id))) continue;
    if (a.handle) replies.set(a.handle, (replies.get(a.handle) ?? 0) + 1);
  }
  queue.push({
    key: "replies",
    tone: "text-accent",
    title: t("q.replies"),
    items: [...replies.entries()].map(([h, n]) => ({ key: h, label: h, sub: t("q.repliesN", { n }), href: `/app/intermediaries/profile?c=${encodeURIComponent(h)}` })),
  });

  // 2) Ціна вища за ліміт проєкту (ще не погоджено)
  const over: QItem[] = [];
  // 3) Дедлайн статті сьогодні / завтра / прострочено
  const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const due: QItem[] = [];
  // 4) Угоди в Outreach без посередника
  const noContact: QItem[] = [];
  for (const d of deals) {
    const st = stageOf(d);
    const b = budgets.get(d.project_id);
    if (["replied", "negotiating", "contacted"].includes(st) && d.gp_price != null && b?.link_budget != null && (d.gp_currency || "USD") === b.budget_currency && d.gp_price > Number(b.link_budget)) {
      const pct = Math.round(((d.gp_price - Number(b.link_budget)) / Number(b.link_budget)) * 100);
      over.push({ key: d.id, label: d.domain, sub: t("q.overSub", { x: fmt(d.gp_price, b.budget_currency), l: fmt(Number(b.link_budget), b.budget_currency), p: pct }), href: open(d) });
    }
    if (d.article_deadline && d.article_deadline <= soon && !["sent", "accepted"].includes(d.article_status) && ["agreed", "writing", "review"].includes(st)) {
      due.push({ key: d.id, label: d.domain, sub: d.article_deadline < today ? t("q.dueLate", { d: d.article_deadline.split("-").reverse().join(".") }) : t("q.dueSoon", { d: d.article_deadline.split("-").reverse().join(".") }), href: "/app/articles" });
    }
    if (d.fg_status === "core" && st === "find" && !d.med_base.trim()) noContact.push({ key: d.id, label: d.domain, sub: pName.get(d.project_id) ?? "", href: open(d) });
  }
  queue.push({ key: "over", tone: "text-warn", title: t("q.over"), items: over });
  queue.push({ key: "due", tone: "text-bad", title: t("q.due"), items: due });
  queue.push({ key: "nocontact", tone: "", title: t("q.noContact"), items: noContact });
  const brokenN = broken ?? 0;
  const followN = plan.length + wait.length;

  const list = sp.l === "wait" || sp.l === "first" || sp.l === "plan" ? sp.l : plan.length ? "plan" : wait.length ? "wait" : "first";

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("out.followup")} project={projectId ? pName.get(projectId) : t("dash.allProjects")} module="outreach" />

      {/* Черга: короткие счётчики + раскрываемые списки */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        {[
          ...queue.map((q) => ({ key: q.key, n: q.items.length, label: q.title, tone: q.tone, href: `#q-${q.key}` })),
          { key: "follow", n: followN, label: t("q.follow"), tone: followN ? "text-accent" : "", href: "#follow" },
          { key: "broken", n: brokenN, label: t("dash.tBroken"), tone: brokenN ? "text-bad" : "", href: "/app/monitoring" },
        ].map((x) => (
          <a key={x.key} href={x.href} className="card flex flex-col gap-0.5 py-3 hover:border-accent">
            <span className={`font-mono text-2xl font-bold tabular-nums ${x.n ? x.tone : "text-mute"}`}>{x.n}</span>
            <span className="text-xs leading-tight text-mute">{x.label}</span>
          </a>
        ))}
      </section>
      {queue.filter((q) => q.items.length).map((q) => (
        <details key={q.key} id={`q-${q.key}`} className="card" open={q.items.length <= 8}>
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className={`font-mono font-bold ${q.tone}`}>{q.items.length}</span>
            <span className="font-semibold">{q.title}</span>
          </summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {q.items.slice(0, 50).map((it) => (
              <li key={it.key}>
                <a href={it.href} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono">{it.label}</span>
                  <span className="shrink-0 text-xs text-mute">{it.sub}</span>
                </a>
              </li>
            ))}
          </ul>
          {q.items.length > 50 && <p className="mt-1 text-xs text-mute">{t("q.more", { n: q.items.length - 50 })}</p>}
        </details>
      ))}
      <h2 id="follow" className="mt-2 font-display text-lg font-semibold">{t("q.followTitle")}</h2>
      <FollowUp
        key={`${list}-${days}-${projectId ?? ""}`}
        list={list}
        days={days}
        dayOptions={DAYS}
        lists={{ plan, wait, first }}
        templates={(tpl ?? []) as { id: string; name: string; body: string }[]}
        mail={(mail as { email: string } | null)?.email ?? null}
      />
    </div>
  );
}
