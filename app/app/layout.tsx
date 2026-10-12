import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { signOut } from "@/app/actions/auth";
import { switchTeam } from "@/app/actions/team";

export const dynamic = "force-dynamic";

const SOON = ["База посередників", "Проєкти", "Таски"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, teams, team } = await getTeamContext();

  return (
    <div className="app-shell">
      <nav className="side">
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
          <p className="side-team px-2 text-sm">{team.name}</p>
        )}

        <div className="side-group">
          <Link href="/app" className="side-link">Дашборд</Link>
          <Link href="/app/input" className="side-link">Інпут</Link>
          <Link href="/app/global" className="side-link">Глобальна база</Link>
          <Link href="/app/team" className="side-link">Команда</Link>
          {SOON.map((s) => (
            <span key={s} className="side-link side-soon" title="Скоро">{s}</span>
          ))}
        </div>

        <div className="side-foot">
          <p className="truncate px-2 text-xs opacity-70">{user.email}</p>
          <p className="px-2 text-xs opacity-70">{team.role === "lead" ? "Тімлід" : "Лінкбілдер"}</p>
          <form action={signOut}>
            <button type="submit" className="side-link">Вийти</button>
          </form>
        </div>
      </nav>

      <main className="min-w-0 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
