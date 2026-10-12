import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll, chunk } from "@/lib/fetchAll";
import { fmtDateTime } from "@/lib/global";
import { DONOR_COLUMNS, normalizeFilter, type CustomStatuses, type Project, type ProjectDonor } from "@/lib/project";
import FromGlobal from "./FromGlobal";
import Core from "./Core";
import Comm, { type MedBusy } from "./Comm";
import GuestPosting from "./GuestPosting";
import Profile from "./Profile";

type Params = Promise<{ id: string }>;
type Search = Promise<{ tab?: string; mine?: string; q?: string; error?: string; saved?: string }>;

const TABS = [
  { key: "fg", label: "From Global" },
  { key: "core", label: "Project Core" },
  { key: "comm", label: "Communication" },
  { key: "gp", label: "Guest Posting" },
  { key: "history", label: "Історія" },
  { key: "profile", label: "Профіль" },
] as const;

const FIELD_LABEL: Record<string, string> = {
  fg_status: "From Global",
  core_status: "Статус Core",
  comm_status: "Статус комунікації",
  gp_status: "Статус GP",
  assignee: "Відповідальний",
  pay_status: "Оплата",
  gp_price: "Ціна",
  gp_currency: "Валюта",
  link_status: "Перевірка посилання",
  indicator: "Індикатор",
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
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "fg";
  const mine = sp.mine === "1";
  const q = (sp.q ?? "").trim().toLowerCase();
  const { supabase, team, user } = await getTeamContext();

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, niche, plan_per_month, requirements, notes, metric_filter, report_token, report_show_prices")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!projectData) notFound();
  const project = projectData as Project & { report_token: string | null; report_show_prices: boolean };

  const donors = await fetchAll<ProjectDonor>((from, to) => {
    let query = supabase.from("project_donors").select(DONOR_COLUMNS).eq("project_id", id).eq("team_id", team.id);
    if (mine) query = query.eq("assignee", user.id);
    if (q) query = query.ilike("domain", `%${q.replace(/[%_]/g, "")}%`);
    return query.order("added_at", { ascending: false }).order("domain").range(from, to);
  });

  const members = await loadMembers(supabase, team.id);
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  const { data: customData } = await supabase.from("custom_statuses").select("kind, name").eq("team_id", team.id).order("created_at");
  const custom: CustomStatuses = { core_pos: [], core_neg: [], comm: [] };
  for (const r of (customData ?? []) as { kind: keyof CustomStatuses; name: string }[]) custom[r.kind]?.push(r.name);

  const { data: projData } = await supabase.from("projects").select("id, name").eq("team_id", team.id);
  const projectName = new Map(((projData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  // ---------- Дубли: этот же донор в работе в других проектах ----------
  const dupes: Record<string, string[]> = {};
  if (tab === "core" || tab === "comm" || tab === "gp") {
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
        const stage = o.core_status === "Published" ? "опубліковано" : o.in_gp ? "Guest Posting" : o.in_comm ? "Communication" : "Core";
        const who = o.assignee ? ` · ${memberName.get(o.assignee) ?? "?"}` : "";
        (dupes[o.domain] ??= []).push(`${projectName.get(o.project_id) ?? "Проєкт"} · ${stage}${who}`);
      }
    }
  }

  // ---------- С этим посредником уже общаются ----------
  const medBusy: MedBusy = {};
  if (tab === "comm") {
    const meds = [...new Set(donors.filter((d) => d.in_comm && d.med_base).map((d) => d.med_base))];
    for (const part of chunk(meds, 100)) {
      const { data } = await supabase
        .from("project_donors")
        .select("id, project_id, domain, assignee, fg_status, core_status, in_comm, in_gp, med_base, indicator, comm_status")
        .eq("team_id", team.id)
        .eq("in_comm", true)
        .in("med_base", part);
      for (const o of (data ?? []) as OtherRow[]) {
        if (!o.indicator && !o.comm_status) continue;
        (medBusy[o.med_base] ??= []).push({
          donorId: o.id,
          assignee: o.assignee,
          label: `${o.assignee ? memberName.get(o.assignee) ?? "?" : "без відповідального"} · ${projectName.get(o.project_id) ?? ""} · ${o.domain}`,
        });
      }
    }
  }

  const count = (pred: (d: ProjectDonor) => boolean) => donors.filter(pred).length;
  const counts: Record<string, number | null> = {
    fg: donors.length,
    core: count((d) => d.fg_status === "core"),
    comm: count((d) => d.in_comm),
    gp: count((d) => d.in_gp),
    history: null,
    profile: null,
  };

  const qs = (t: string, m = mine) => {
    const p = new URLSearchParams({ tab: t });
    if (m) p.set("mine", "1");
    if (q) p.set("q", q);
    return `/app/projects/${id}?${p.toString()}`;
  };
  const isLead = team.role === "lead";

  let stopTools: string[] = [];
  let stopGlobalCount = 0;
  if (tab === "profile" || tab === "fg") {
    const stop = await fetchAll<{ domain: string; source: string }>((from, to) =>
      supabase.from("project_stoplist").select("domain, source").eq("project_id", id).order("domain").range(from, to),
    );
    stopTools = stop.filter((s) => s.source === "tools").map((s) => s.domain);
    stopGlobalCount = stop.length - stopTools.length;
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
          <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-medium">
            {project.name}
            {project.niche && <span className="pill font-sans">{project.niche}</span>}
          </h1>
          <p className="mt-1 text-mute">From Global → Project Core → Communication → Guest Posting</p>
        </div>
        {tab !== "profile" && tab !== "history" && (
          <div className="flex flex-wrap items-center gap-2">
            <form className="flex gap-1" action={`/app/projects/${id}`}>
              <input type="hidden" name="tab" value={tab} />
              {mine && <input type="hidden" name="mine" value="1" />}
              <label htmlFor="pq" className="sr-only">Пошук домену</label>
              <input id="pq" name="q" defaultValue={q} className="inp w-44" placeholder="пошук домену" />
              <button type="submit" className="btn btn-sm">Знайти</button>
            </form>
            <Link href={qs(tab, !mine)} className={`btn btn-sm ${mine ? "btn-pri" : ""}`}>
              {mine ? "Показано: мої донори" : "Показати тільки мої"}
            </Link>
            <a href={`/api/export?type=project&id=${id}`} className="btn btn-sm">Експорт CSV</a>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={qs(t.key)} className={`tab whitespace-nowrap ${tab === t.key ? "tab-on" : ""}`}>
            {t.label}
            {counts[t.key] != null && <span className="ml-1 font-mono text-xs">{counts[t.key]}</span>}
          </Link>
        ))}
      </div>

      {q && (
        <p className="text-sm text-mute">
          Пошук: «{q}» · <Link href={qs(tab).replace(/&q=[^&]*/, "")} className="underline">скинути</Link>
        </p>
      )}
      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}
      {sp.saved && <p className="note note-ok" role="status">Збережено.</p>}

      {tab === "fg" && <FromGlobal projectId={id} rows={donors} stopTools={stopTools.length} stopGlobal={stopGlobalCount} />}
      {tab === "core" && (
        <Core projectId={id} rows={donors.filter((d) => d.fg_status === "core")} custom={custom} members={members} dupes={dupes} />
      )}
      {tab === "comm" && (
        <Comm projectId={id} rows={donors.filter((d) => d.in_comm)} custom={custom} members={members} dupes={dupes} medBusy={medBusy} />
      )}
      {tab === "gp" && <GuestPosting projectId={id} rows={donors.filter((d) => d.in_gp)} dupes={dupes} />}

      {tab === "history" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>{["Коли", "Хто", "Донор", "Що змінено", "Було", "Стало"].map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                  <td className="whitespace-nowrap">{l.user_id ? memberName.get(l.user_id) ?? "?" : "система"}</td>
                  <td className="font-mono">{l.domain}</td>
                  <td>{FIELD_LABEL[l.field] ?? l.field}</td>
                  <td className="text-mute">{showValue(l.field, l.old_value)}</td>
                  <td>{showValue(l.field, l.new_value)}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={6} className="text-center text-mute">Змін ще не було.</td></tr>
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
          stopGlobalCount={stopGlobalCount}
          reportUrl={project.report_token ? `${origin}/r/${project.report_token}` : null}
          reportPrices={project.report_show_prices}
        />
      )}
    </div>
  );
}
