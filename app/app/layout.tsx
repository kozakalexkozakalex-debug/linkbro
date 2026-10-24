import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { signOut } from "@/app/actions/auth";
import { switchTeam } from "@/app/actions/team";
import NavLink from "@/components/NavLink";
import LangSwitch from "@/components/LangSwitch";
import MobileNav from "@/components/MobileNav";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, teams, team } = await getTeamContext();
  const { data } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string }[];
  const isLead = team.role === "lead";
  const { t } = await getI18n();

  return (
    <div className="app-shell">
      <MobileNav teamName={team.name} />
      <nav className="side" aria-label={t("nav.menu")}>
        <Link href="/app" className="font-logo px-3 text-lg font-bold">
          Link<span className="text-[#ff8a3d]">Bro</span>
        </Link>

        {teams.length > 1 ? (
          <form action={switchTeam} className="side-team">
            <label htmlFor="team_id" className="sr-only">{t("team.title")}</label>
            <select id="team_id" name="team_id" defaultValue={team.id} className="side-select">
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>
            <button type="submit" className="side-link">{t("nav.go")}</button>
          </form>
        ) : (
          <p className="side-team side-team-name">{team.name}</p>
        )}

        <div className="side-group">
          <p className="side-label">{t("nav.work")}</p>
          <div className="side-sub">
            <NavLink href="/app/today">{t("nav.today")}</NavLink>
            <NavLink href="/app" exact>{t("nav.dashboard")}</NavLink>
            <NavLink href="/app/tasks">{t("nav.tasks")}</NavLink>
            <NavLink href="/app/finance">{t("nav.money")}</NavLink>
          </div>
        </div>

        <div className="side-group">
          <p className="side-label">{t("nav.base")}</p>
          <div className="side-sub">
            <NavLink href="/app/global">{t("nav.sites")}</NavLink>
            <NavLink href="/app/intermediaries">{t("nav.contacts")}</NavLink>
            <NavLink href="/app/writers">{t("nav.writers")}</NavLink>
            <NavLink href="/app/templates">{t("nav.templates")}</NavLink>
            <NavLink href="/app/input">{t("nav.add")}</NavLink>
          </div>
        </div>

        <div className="side-group">
          <p className="side-label">
            <span>{t("common.projects")}</span>
            {isLead && (
              <Link href="/app/projects/new" className="side-plus" title={t("nav.newProject")} aria-label={t("nav.newProject")}>+</Link>
            )}
          </p>
          <div className="side-sub">
            {projects.map((p) => (
              <NavLink key={p.id} href={`/app/projects/${p.id}`} className="truncate">
                {p.name}
              </NavLink>
            ))}
            {projects.length === 0 && <span className="side-empty">{isLead ? t("nav.pressPlus") : t("nav.noProjectsYet")}</span>}
            {isLead && <NavLink href="/app/projects/new" className="side-add-mobile">{t("nav.addProject")}</NavLink>}
          </div>
        </div>

        <div className="side-foot">
          <NavLink href="/app/team">{t("team.title")}</NavLink>
          <div className="px-2"><LangSwitch dark /></div>
          <p className="truncate px-2 text-xs opacity-70">{user.email}</p>
          <p className="px-2 text-xs opacity-70">{isLead ? t("common.lead") : t("common.builder")}</p>
          <form action={signOut}>
            <button type="submit" className="side-link">{t("auth.logout")}</button>
          </form>
        </div>
      </nav>

      <main className="min-w-0 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
