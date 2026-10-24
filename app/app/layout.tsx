import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { signOut } from "@/app/actions/auth";
import { switchTeam } from "@/app/actions/team";
import NavLink from "@/components/NavLink";
import LangSwitch from "@/components/LangSwitch";
import MobileNav from "@/components/MobileNav";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import { PROJECT_NAV, SETTINGS_NAV, TEAM_NAV } from "@/lib/nav";
import { SCOPE_COOKIE } from "@/lib/scope";
import { cookies } from "next/headers";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, teams, team } = await getTeamContext();
  const { data } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string }[];
  const isLead = team.role === "lead";
  const saved = (await cookies()).get(SCOPE_COOKIE)?.value;
  const scope = projects.some((p) => p.id === saved) ? (saved as string) : null;
  const { t } = await getI18n();

  return (
    <div className="app-shell">
      <MobileNav title={scope ? projects.find((p) => p.id === scope)?.name ?? team.name : team.name} />
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

        {/* Общее для команды */}
        <div className="side-group">
          <div className="side-sub">
            {TEAM_NAV.map((m) => (
              <NavLink key={m.href} href={m.href} exact={m.exact} also={m.also}>{t(m.key)}</NavLink>
            ))}
          </div>
        </div>

        {/* Выбранный проект и его разделы */}
        <div className="side-project">
          <ProjectSwitcher projects={projects} current={scope} isLead={isLead} />
          <div className="side-sub">
            {PROJECT_NAV.map((m) => (
              <NavLink key={m.href} href={m.href} exact={m.exact} also={m.also}>{t(m.key)}</NavLink>
            ))}
            <NavLink href={SETTINGS_NAV.href}>⚙ {t(SETTINGS_NAV.key)}</NavLink>
          </div>
        </div>

        <div className="side-foot">
          <NavLink href="/app/team">{t("team.title")}</NavLink>
          <NavLink href="/app/mail">{t("nav.mail")}</NavLink>
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
