import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll, chunk } from "@/lib/fetchAll";
import { fmtDateTime } from "@/lib/global";
import { DONOR_COLUMNS, PROJECT_COLUMNS, normalizeFilter, type CustomStatuses, type Project, type ProjectDonor } from "@/lib/project";
import Work, { type MedBusy } from "./Work";
import { OVERVIEW, OVERVIEW_KEY, overviewOf } from "@/lib/stages";
import BoardHost from "./BoardHost";
import Profile from "./Profile";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";

type Params = Promise<{ id: string }>;
type Search = Promise<{ tab?: string; mine?: string; q?: string; error?: string; saved?: string; view?: string }>;

const TABS: { key: string; label: MsgKey }[] = [
  { key: "overview", label: "ptab.overview" },
  { key: "pool", label: "ptab.pool" },
  { key: "work", label: "ptab.outreach" },
  { key: "monitor", label: "ptab.monitor" },
  { key: "history", label: "proj.tabHistory" },
  { key: "profile", label: "proj.tabProfile" },
];

const FIELD_LABEL: Record<string, MsgKey> = {
  fg_status: "field.fg",
  core_status: "field.core",
  comm_status: "field.comm",
  gp_status: "field.gp",
  assignee: "common.assignee",
  pay_status: "field.pay",
  gp_price: "common.price",
  gp_currency: "common.currency",
  link_status: "field.link",
  indicator: "field.indicator",
};

type OtherRow = {
  id: string;
  project_id: string;
  domain: string;
  assignee: string | null;
  fg_status: string;
  core_status: string;
  in_comm: boolean;
  in_gp: boolean;
  med_base: string;
  indicator: string | null;
  comm_status: string;
};

type LogRow = { id: number; domain: string | null; user_id: string | null; field: string; old_value: string | null; new_value: string | null; created_at: string };

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const sp = await searchParams;
  const askTab = ["core", "comm", "gp"].includes(sp.tab ?? "") ? "work" : sp.tab === "fg" ? "pool" : sp.tab;
  const tab = TABS.some((x) => x.key === askTab) ? (askTab as string) : "overview";
  const mine = sp.mine === "1";
  const q = (sp.q ?? "").trim().toLowerCase();
  const { supabase, team, user } = await getTeamContext();
  const { t, intl } = await getI18n();

  // Все независимые запросы — параллельно
  const [{ data: projectData }, donors, members, { data: customData }, { data: projData }] = await Promise.all([
    supabase
    .from("projects")
    .select(PROJECT_COLUMNS + ", report_token, report_show_prices")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle(),
    fetchAll<ProjectDonor>((from, to) => {
    let query = supabase.from("project_donors").select(DONOR_COLUMNS).eq("project_id", id).eq("team_id", team.id);
    if (mine) query = query.eq("assignee", user.id);
    if (q) query = query.ilike("domain", `%${q.replace(/[%_]/g, "")}%`);
    return query.order("added_at", { ascending: false }).order("domain").range(from, to);
  }),
    loadMembers(supabase, team.id),
    supabase.from("custom_statuses").select("kind, name").eq("team_id", team.id).order("created_at"),
    supabase.from("projects").select("id, name").eq("team_id", team.id),
  ]);
  if (!projectData) notFound();
  const project = projectData as unknown as Project & { report_token: string | null; report_show_prices: boolean };
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const custom: CustomStatuses = { core_pos: [], core_neg: [], comm: [] };
  for (const r of (customData ?? []) as { kind: keyof CustomStatuses; name: string }[]) custom[r.kind]?.push(r.name);
  const projectName = new Map(((projData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  // ---------- Дубли: этот же донор в работе в других проектах ----------
  const dupes: Record<string, string[]> = {};
  if (tab === "work") {
    const domains = [...new Set(donors.map((d) => d.domain))];
    for (const part of chunk(domains, 200)) {
      const { data } = await supabase
        .from("project_donors")
        .select("id, project_id, domain, assignee, fg_status, core_status, in_comm, in_gp, med_base, indicator, comm_status")
        .eq("team_id", team.id)
        .neq("project_id", id)
        .in("domain", part);
      for (const o of (data ?? []) as OtherRow[]) {
        if (!(o.in_comm || o.in_gp || o.fg_status === "core")) continue;
        const stage = o.core_status === "Published" ? t("proj.stagePublished") : o.in_gp ? "Guest Posting" : o.in_comm ? "Communication" : "Core";
        const who = o.assignee ? ` · ${memberName.get(o.assignee) ?? "?"}` : "";
        (dupes[o.domain] ??= []).push(`${projectName.get(o.project_id) ?? t("common.project")} · ${stage}${who}`);
      }
    }
  }

  // ---------- С этим посредником уже общаются ----------
  const medBusy: MedBusy = {};
  if (tab === "work") {
    const meds = [...new Set(donors.filter((d) => d.fg_status === "core" && d.med_base).map((d) => d.med_base))];
    for (const part of chunk(meds, 100)) {
      const { data } = await supabase
        .from("project_donors")
        .select("id, project_id, domain, assignee, fg_status, core_status, in_comm, in_gp, med_base, indicator, comm_status")
        .eq("team_id", team.id)
        .eq("fg_status", "core")
        .in("med_base", part);
      for (const o of (data ?? []) as OtherRow[]) {
        if (!o.indicator && !o.comm_status) continue;
        (medBusy[o.med_base] ??= []).push({
          donorId: o.id,
          assignee: o.assignee,
          label: `${o.assignee ? memberName.get(o.assignee) ?? "?" : t("common.withoutAssignee")} · ${projectName.get(o.project_id) ?? ""} · ${o.domain}`,
        });
      }
    }
  }

  const count = (pred: (d: ProjectDonor) => boolean) => donors.filter(pred).length;
  const counts: Record<string, number | null> = {
    overview: donors.length,
    pool: count((d) => ["new", "check", "ok"].includes(d.fg_status)),
    work: count((d) => d.fg_status === "core"),
    monitor: count((d) => d.stage === "published" || !!d.article_url),
    history: null,
    profile: null,
  };

  const qs = (tb: string, m = mine) => {
    const p = new URLSearchParams({ tab: tb });
    if (m) p.set("mine", "1");
    if (q) p.set("q", q);
    return `/app/projects/${id}?${p.toString()}`;
  };
  const isLead = team.role === "lead";

  let stopTools: string[] = [];
  let stopGlobal: string[] = [];
  let stopGlobalCount = 0;
  if (tab === "profile" || tab === "pool") {
    const stop = await fetchAll<{ domain: string; source: string }>((from, to) =>
      supabase.from("project_stoplist").select("domain, source").eq("project_id", id).order("domain").range(from, to),
    );
    stopTools = stop.filter((s) => s.source === "tools").map((s) => s.domain);
    stopGlobal = stop.filter((s) => s.source === "global").map((s) => s.domain);
    stopGlobalCount = stopGlobal.length;
  }

  let log: LogRow[] = [];
  if (tab === "history") {
    const { data } = await supabase
      .from("activity_log")
      .select("id, domain, user_id, field, old_value, new_value, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(300);
    log = (data ?? []) as LogRow[];
  }
  const showValue = (field: string, v: string | null) => {
    if (v == null || v === "") return "—";
    if (field === "assignee") return memberName.get(v) ?? "?";
    return v;
  };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            {project.name}
            {project.niche && <span className="pill font-sans">{project.niche}</span>}
            {project.geo && <span className="pill font-sans">{project.geo}</span>}
            {project.language && <span className="pill font-sans">{project.language}</span>}
          </h1>
          {project.client_site && (
            <a
              href={/^https?:\/\//.test(project.client_site) ? project.client_site : `https://${project.client_site}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-mono text-sm underline"
            >
              {project.client_site}
            </a>
          )}
          <p className="mt-1 text-mute">From Global → Project Core → Communication → Guest Posting</p>
        </div>
        {tab !== "profile" && tab !== "history" && (
          <div className="flex flex-wrap items-center gap-2">
            <form className="flex gap-1" action={`/app/projects/${id}`}>
              <input type="hidden" name="tab" value={tab} />
              {mine && <input type="hidden" name="mine" value="1" />}
              <label htmlFor="pq" className="sr-only">{t("common.searchDomain")}</label>
              <input id="pq" name="q" defaultValue={q} className="inp w-44 max-sm:w-full" placeholder={t("common.searchDomain")} />
              <button type="submit" className="btn btn-sm">{t("common.find")}</button>
            </form>
            <Link href={qs(tab, !mine)} className={`btn btn-sm ${mine ? "btn-pri" : ""}`}>
              {mine ? t("proj.mineOn") : t("proj.mineOff")}
            </Link>
            <a href={`/api/export?type=project&id=${id}`} className="btn btn-sm max-sm:hidden">{t("common.exportCsv")}</a>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tb) => (
          <Link key={tb.key} href={qs(tb.key)} className={`tab whitespace-nowrap ${tab === tb.key ? "tab-on" : ""}`}>
            {t(tb.label)}
            {counts[tb.key] != null && <span className="ml-1 font-mono text-xs">{counts[tb.key]}</span>}
          </Link>
        ))}
      </div>

      {/* Где сейчас сайты проекта — видно на любой вкладке, клик ведёт в общий канбан */}
      {tab !== "overview" && (() => {
        const cnt = new Map<string, number>();
        for (const d of donors) {
          const s = overviewOf(d);
          cnt.set(s, (cnt.get(s) ?? 0) + 1);
        }
        return (
          <nav className="pipe" aria-label={t("ptab.overview")}>
            {OVERVIEW.map((s) => (
              <Link key={s} href={qs("overview")} className={`pipe-step ${cnt.get(s) ? "" : "pipe-empty"}`}>
                <span className="text-base font-bold tabular-nums">{cnt.get(s) ?? 0}</span>
                <span className="truncate text-[11px] text-mute">{t(OVERVIEW_KEY[s])}</span>
              </Link>
            ))}
          </nav>
        );
      })()}

      {q && (
        <p className="text-sm text-mute">
          {t("proj.searchFor", { q })} · <Link href={qs(tab).replace(/&q=[^&]*/, "")} className="underline">{t("common.reset").toLowerCase()}</Link>
        </p>
      )}
      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}
      {sp.saved && <p className="note note-ok" role="status">{t("common.saved")}</p>}

      {tab === "overview" && <BoardHost kind="overview" projectId={id} rows={donors} />}
      {tab === "pool" && <BoardHost kind="pool" projectId={id} rows={donors} stopTools={stopTools.length} stopGlobal={stopGlobalCount} />}
      {tab === "monitor" && <BoardHost kind="monitor" projectId={id} rows={donors} />}
      {tab === "work" && (
        <Work projectId={id} initialView={sp.view === "kanban" || sp.view === "table" ? sp.view : undefined} rows={donors.filter((d) => d.fg_status === "core")} custom={custom} members={members} dupes={dupes} medBusy={medBusy} />
      )}

      {tab === "history" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>{(["hist.when", "hist.who", "med.donor", "hist.what", "hist.before", "hist.after"] as const).map((c) => <th key={c}>{t(c)}</th>)}</tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono whitespace-nowrap">{fmtDateTime(l.created_at, intl)}</td>
                  <td className="whitespace-nowrap">{l.user_id ? memberName.get(l.user_id) ?? "?" : t("hist.system")}</td>
                  <td className="font-mono">{l.domain}</td>
                  <td>{FIELD_LABEL[l.field] ? t(FIELD_LABEL[l.field]) : l.field}</td>
                  <td className="text-mute">{showValue(l.field, l.old_value)}</td>
                  <td>{showValue(l.field, l.new_value)}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={6} className="text-center text-mute">{t("hist.empty")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "profile" && (
        <Profile
          project={{ ...project, filter: normalizeFilter(project.metric_filter) }}
          isLead={isLead}
          stopTools={stopTools}
          stopGlobal={stopGlobal}
          stopGlobalCount={stopGlobalCount}
          reportUrl={project.report_token ? `${origin}/r/${project.report_token}` : null}
          reportPrices={project.report_show_prices}
        />
      )}
    </div>
  );
}
