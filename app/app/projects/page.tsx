import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { fetchAll } from "@/lib/fetchAll";
import { stageOf } from "@/lib/stages";
import ModuleHead from "@/components/ModuleHead";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { projectDot } from "@/lib/projectColor";

type P = { id: string; name: string; niche: string; geo: string; plan_per_month: number };
type D = { project_id: string; stage: string | null; core_status: string; indicator: string | null; fg_status: string; published_at: string | null; link_status: string };

const WORK = ["contacted", "replied", "negotiating", "agreed", "writing", "review", "sent", "paid"];
const PROBLEM = ["error", "lost", "suspect", "warn"];

// Проєкти карточками: с них начинается работа. Клик — проект выбран, открывается Prefero.
// Внутри проекта: Prefero · Outreach · Моніторинг · Налаштування (боковое меню).
export default async function ProjectsPage() {
  const [{ supabase, team }, { t }] = await Promise.all([getTeamContext(), getI18n()]);
  const [{ data }, deals] = await Promise.all([
    supabase.from("projects").select("id, name, niche, geo, plan_per_month").eq("team_id", team.id).order("created_at"),
    fetchAll<D>((from, to) =>
      supabase.from("project_donors").select("project_id, stage, core_status, indicator, fg_status, published_at, link_status").eq("team_id", team.id).range(from, to),
    ),
  ]);
  const projects = (data ?? []) as P[];
  const month = new Date().toISOString().slice(0, 7);
  const stats = new Map<string, { prefero: number; work: number; month: number; live: number; problems: number }>();
  for (const p of projects) stats.set(p.id, { prefero: 0, work: 0, month: 0, live: 0, problems: 0 });
  for (const d of deals) {
    const s = stats.get(d.project_id);
    if (!s) continue;
    if (d.fg_status === "new" || d.fg_status === "ok") s.prefero++;
    if (d.fg_status !== "core") continue;
    const st = stageOf(d);
    if (WORK.includes(st)) s.work++;
    if (st === "published") {
      if (d.published_at?.startsWith(month)) s.month++;
      if (PROBLEM.includes(d.link_status)) s.problems++;
      else s.live++;
    }
  }
  const go = (id: string, next: string) => `/app/scope?p=${id}&next=${encodeURIComponent(next)}`;
  const isLead = team.role === "lead";

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead
        title={t("common.projects")}
        hint={t("proj.hint")}
        right={isLead && <Link href="/app/projects/new" className="btn btn-pri"><Icon name="plus" size={14} />{t("nav.newProject")}</Link>}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon="folder"
          title={t("proj.emptyTitle")}
          text={isLead ? t("nav.pressPlus") : t("nav.noProjectsYet")}
          action={isLead ? <Link href="/app/projects/new" className="btn btn-pri">{t("nav.newProject")}</Link> : null}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, i) => {
            const s = stats.get(p.id)!;
            const pct = p.plan_per_month ? Math.min(100, Math.round((s.month / p.plan_per_month) * 100)) : 0;
            return (
              <li key={p.id} className="proj-card">
                <div className="flex items-center gap-2">
                  <span className="picker-dot" style={{ background: projectDot(i) }} />
                  <Link href={go(p.id, "/app/domains")} className="proj-link min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {p.name}
                  </Link>
                  <Link href={go(p.id, "/app/settings")} className="icon-btn relative z-10" aria-label={`${t("mod.settingsShort")}: ${p.name}`} title={t("mod.settingsShort")}>
                    <Icon name="gear" size={14} />
                  </Link>
                </div>
                {(p.niche || p.geo) && <p className="text-xs text-mute">{[p.niche, p.geo].filter(Boolean).join(" · ")}</p>}

                <div>
                  <div className="flex justify-between text-xs text-mute">
                    <span>{t("proj.thisMonth")}</span>
                    <span className="font-mono text-ink">{s.month}{p.plan_per_month ? ` / ${p.plan_per_month}` : ""}</span>
                  </div>
                  <div className="meter mt-1.5"><span style={{ width: `${pct}%` }} /></div>
                </div>

                <dl className="proj-stats">
                  <div><dt>{t("proj.inWork")}</dt><dd>{s.work}</dd></div>
                  <div><dt>{t("proj.live")}</dt><dd>{s.live}</dd></div>
                  <div><dt>{t("proj.problems")}</dt><dd className={s.problems ? "text-bad" : ""}>{s.problems}</dd></div>
                </dl>

                <nav className="relative z-10 flex flex-wrap gap-1 border-t border-line pt-2" aria-label={p.name}>
                  <Link href={go(p.id, "/app/domains")} className="btn btn-ghost btn-sm">
                    Prefero{s.prefero > 0 && <span className="font-mono text-accent">{s.prefero}</span>}
                  </Link>
                  <Link href={go(p.id, "/app/outreach")} className="btn btn-ghost btn-sm">Outreach</Link>
                  <Link href={go(p.id, "/app/monitoring")} className="btn btn-ghost btn-sm">{t("ptab.monitor")}</Link>
                </nav>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
