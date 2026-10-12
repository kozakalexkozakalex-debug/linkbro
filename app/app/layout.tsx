import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { signOut } from "@/app/actions/auth";
import { switchTeam } from "@/app/actions/team";
import NavLink from "@/components/NavLink";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, teams, team } = await getTeamContext();
  const { data } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string }[];
  const isLead = team.role === "lead";

  return (
    <div className="app-shell">
      <nav className="side" aria-label="Головне меню">
        <Link href="/app" className="font-display px-2 text-base font-bold">
          Link<span className="text-[#3fc7a4]">Bro</span>
        </Link>

        {teams.length > 1 ? (
          <form action={switchTeam} className="side-team">
            <label htmlFor="team_id" className="sr-only">Команда</label>
            <select id="team_id" name="team_id" defaultValue={team.id} className="side-select">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button type="submit" className="side-link">Перейти</button>
          </form>
        ) : (
          <p className="side-team side-team-name">{team.name}</p>
        )}

        <div className="side-group">
          <p className="side-label">Робота</p>
          <div className="side-sub">
            <NavLink href="/app" exact>Дашборд</NavLink>
            <NavLink href="/app/tasks">Таски</NavLink>
            <NavLink href="/app/finance">Фінанси</NavLink>
          </div>
        </div>

        <div className="side-group">
          <p className="side-label">Донори</p>
          <div className="side-sub">
            <NavLink href="/app/input">Інпут</NavLink>
            <NavLink href="/app/global">Глобальна база</NavLink>
            <NavLink href="/app/intermediaries">База посередників</NavLink>
            <NavLink href="/app/import">Імпорт CSV</NavLink>
          </div>
        </div>

        <div className="side-group">
          <p className="side-label">
            <span>Проєкти</span>
            {isLead && (
              <Link href="/app/projects/new" className="side-plus" title="Новий проєкт" aria-label="Новий проєкт">+</Link>
            )}
          </p>
          <div className="side-sub">
            {projects.map((p) => (
              <NavLink key={p.id} href={`/app/projects/${p.id}`} className="truncate">
                {p.name}
              </NavLink>
            ))}
            {projects.length === 0 && <span className="side-empty">{isLead ? "Натисніть +, щоб створити" : "Поки немає"}</span>}
            {isLead && <NavLink href="/app/projects/new" className="side-add-mobile">+ Проєкт</NavLink>}
          </div>
        </div>

        <div className="side-foot">
          <NavLink href="/app/team">Команда</NavLink>
          <p className="truncate px-2 text-xs opacity-70">{user.email}</p>
          <p className="px-2 text-xs opacity-70">{isLead ? "Тімлід" : "Лінкбілдер"}</p>
          <form action={signOut}>
            <button type="submit" className="side-link">Вийти</button>
          </form>
        </div>
      </nav>

      <main className="min-w-0 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
