import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { getScope } from "@/lib/scope";
import { fetchAll } from "@/lib/fetchAll";
import { stageOf, STAGE_KEY } from "@/lib/stages";
import { emailOf } from "@/lib/outreach";
import ModuleHead from "@/components/ModuleHead";
import FollowUp, { type FuRow } from "./FollowUp";

// «Нагадати»: кому написати сьогодні. Три списки — за планом, мовчать N днів, ще не писали.
// Можна виділити кілька угод і надіслати лист усім одразу (кожному — зі своїм доменом у тексті).
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
};
const COLS = "id, project_id, domain, med_base, fg_status, stage, core_status, indicator, indicator_at, next_action_at, next_action, gp_price, gp_currency, anchors, page_url, article_deadline";
const DAYS = [2, 3, 5, 7, 14];

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ d?: string; l?: string }> }) {
  const sp = await searchParams;
  const days = DAYS.includes(Number(sp.d)) ? Number(sp.d) : 3;
  const [{ supabase, team }, { t }, { projectId, projects }] = await Promise.all([getTeamContext(), getI18n(), getScope()]);

  const [deals, { data: tpl }, { data: mail }] = await Promise.all([
    fetchAll<D>((from, to) => {
      let q = supabase.from("project_donors").select(COLS).eq("team_id", team.id).not("stage", "in", "(published,lost)");
      if (projectId) q = q.eq("project_id", projectId);
      return q.order("id").range(from, to);
    }),
    supabase.from("templates").select("id, name, body").eq("team_id", team.id).eq("kind", "message").order("name"),
    supabase.from("mail_accounts").select("email").maybeSingle(),
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

  const list = sp.l === "wait" || sp.l === "first" || sp.l === "plan" ? sp.l : plan.length ? "plan" : wait.length ? "wait" : "first";

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("out.followup")} project={projectId ? pName.get(projectId) : t("dash.allProjects")} module="outreach" />
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
