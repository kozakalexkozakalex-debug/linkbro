import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { fetchAll } from "@/lib/fetchAll";
import { DONOR_COLUMNS, normalizeFilter, type CustomStatuses, type Project, type ProjectDonor } from "@/lib/project";
import FromGlobal from "./FromGlobal";
import Core from "./Core";
import Comm from "./Comm";
import GuestPosting from "./GuestPosting";
import Profile from "./Profile";

type Params = Promise<{ id: string }>;
type Search = Promise<{ tab?: string; mine?: string; error?: string; saved?: string }>;

const TABS = [
  { key: "fg", label: "From Global" },
  { key: "core", label: "Project Core" },
  { key: "comm", label: "Communication" },
  { key: "gp", label: "Guest Posting" },
  { key: "profile", label: "Профіль" },
] as const;

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "fg";
  const mine = sp.mine === "1";
  const { supabase, team, user } = await getTeamContext();

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, plan_per_month, requirements, notes, metric_filter")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!projectData) notFound();
  const project = projectData as Project;

  const donors = await fetchAll<ProjectDonor>((from, to) => {
    let q = supabase.from("project_donors").select(DONOR_COLUMNS).eq("project_id", id).eq("team_id", team.id);
    if (mine) q = q.eq("assignee", user.id);
    return q.order("added_at", { ascending: false }).order("domain").range(from, to);
  });

  const members = await loadMembers(supabase, team.id);

  const { data: customData } = await supabase.from("custom_statuses").select("kind, name").eq("team_id", team.id).order("created_at");
  const custom: CustomStatuses = { core_pos: [], core_neg: [], comm: [] };
  for (const r of (customData ?? []) as { kind: keyof CustomStatuses; name: string }[]) custom[r.kind]?.push(r.name);

  const count = (pred: (d: ProjectDonor) => boolean) => donors.filter(pred).length;
  const counts: Record<string, number | null> = {
    fg: donors.length,
    core: count((d) => d.fg_status === "core"),
    comm: count((d) => d.in_comm),
    gp: count((d) => d.in_gp),
    profile: null,
  };

  const href = (t: string, m = mine) => `/app/projects/${id}?tab=${t}${m ? "&mine=1" : ""}`;
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">{project.name}</h1>
          <p className="mt-1 text-mute">From Global → Project Core → Communication → Guest Posting</p>
        </div>
        {tab !== "profile" && (
          <Link href={href(tab, !mine)} className={`btn btn-sm ${mine ? "btn-pri" : ""}`}>
            {mine ? "Показано: мої донори" : "Показати тільки мої"}
          </Link>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} className={`tab whitespace-nowrap ${tab === t.key ? "tab-on" : ""}`}>
            {t.label}
            {counts[t.key] != null && <span className="ml-1 font-mono text-xs">{counts[t.key]}</span>}
          </Link>
        ))}
      </div>

      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}
      {sp.saved && <p className="note note-ok" role="status">Збережено.</p>}

      {tab === "fg" && (
        <FromGlobal projectId={id} rows={donors} stopTools={stopTools.length} stopGlobal={stopGlobalCount} />
      )}
      {tab === "core" && (
        <Core projectId={id} rows={donors.filter((d) => d.fg_status === "core")} custom={custom} members={members} />
      )}
      {tab === "comm" && (
        <Comm projectId={id} rows={donors.filter((d) => d.in_comm)} custom={custom} members={members} />
      )}
      {tab === "gp" && <GuestPosting projectId={id} rows={donors.filter((d) => d.in_gp)} />}
      {tab === "profile" && (
        <Profile
          project={{ ...project, filter: normalizeFilter(project.metric_filter) }}
          isLead={isLead}
          stopTools={stopTools}
          stopGlobalCount={stopGlobalCount}
        />
      )}
    </div>
  );
}
