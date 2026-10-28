import Link from "next/link";
import { cookies } from "next/headers";
import { getTeamContext } from "@/lib/team";
import { signOut } from "@/app/actions/auth";
import { switchTeam } from "@/app/actions/team";
import NavLink from "@/components/NavLink";
import LangSwitch from "@/components/LangSwitch";
import MobileNav from "@/components/MobileNav";
import TopBar from "@/components/TopBar";
import SideProjects from "@/components/SideProjects";
import Icon from "@/components/Icon";
import { projectDot } from "@/lib/projectColor";
import { ACCOUNT_NAV, PROJECT_NAV, TEAM_NAV } from "@/lib/nav";
import { SCOPE_COOKIE } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

// Каркас приложения: меню слева (общее сверху, разделы проекта ниже), верхняя панель с выбором проекта, рабочая область.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ supabase, user, teams, team }, { t }, jar] = await Promise.all([getTeamContext(), getI18n(), cookies()]);
  const { data } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string }[];
  const isLead = team.role === "lead";
  const saved = jar.get(SCOPE_COOKIE)?.value;
  const scope = projects.some((p) => p.id === saved) ? (saved as string) : null;
  const idx = projects.findIndex((p) => p.id === scope);

  return (
    <div className="app-shell">
      <nav className="side" aria-label={t("nav.menu")}>
        <Link href="/app" className="side-logo" aria-label="LinkBro">
          <Logo />
        </Link>

        {teams.length > 1 && (
          <form action={switchTeam} className="side-team">
            <label htmlFor="team_id" className="sr-only">{t("team.title")}</label>
            <select id="team_id" name="team_id" defaultValue={team.id} className="side-select">
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm">{t("nav.go")}</button>
          </form>
        )}

        {/* Загальне: не относится к конкретному проекту */}
        <div className="side-group">
          {TEAM_NAV.map((m) => (
            <NavLink key={m.href} href={m.href} exact={m.exact} also={m.also}>
              <Icon name={m.icon} />
              {t(m.key)}
            </NavLink>
          ))}
        </div>

        {/* Проєкти: текущий проект (всплывающий список) + «+», ниже — разделы выбранного проекта */}
        <div className="side-group">
          <SideProjects projects={projects} current={scope} isLead={isLead} />
          {idx >= 0 &&
            PROJECT_NAV.map((m) => (
              <NavLink key={m.href} href={m.href} exact={m.exact} also={m.also} className="side-in">
                <Icon name={m.icon} />
                {t(m.key)}
              </NavLink>
            ))}
        </div>

        <div className="side-foot">
          {ACCOUNT_NAV.map((m) => (
            <NavLink key={m.href} href={m.href} also={m.also}>
              <Icon name={m.icon} />
              {t(m.key)}
            </NavLink>
          ))}
          <div className="side-user">
            <span className="avatar">{(user.email ?? "?").slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{user.email}</span>
              <span className="block text-xs">{team.name} · {isLead ? t("common.lead") : t("common.builder")}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 px-2">
            <LangSwitch dark />
            <form action={signOut} className="ml-auto">
              <button type="submit" className="btn btn-ghost btn-sm" title={t("auth.logout")}>
                <Icon name="logout" size={14} />
                {t("auth.logout")}
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="app-main">
        <TopBar project={idx >= 0 ? projects[idx].name : null} dot={projectDot(Math.max(idx, 0))} />
        <main className="app-content">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
