import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";

// Список проектов (на телефоне — вкладка «Проєкти» в нижнем меню)
export default async function ProjectsPage() {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const { data } = await supabase.from("projects").select("id, name, niche, geo").eq("team_id", team.id).order("created_at");
  const projects = (data ?? []) as { id: string; name: string; niche: string; geo: string }[];

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-medium">{t("common.projects")}</h1>
        {team.role === "lead" && <Link href="/app/projects/new" className="btn btn-pri btn-sm">{t("nav.addProject")}</Link>}
      </div>
      {projects.length === 0 ? (
        <p className="card text-center text-mute">{team.role === "lead" ? t("nav.pressPlus") : t("nav.noProjectsYet")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/app/projects/${p.id}`} className="card flex items-center gap-2 hover:border-accent">
                <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                {p.niche && <span className="pill">{p.niche}</span>}
                {p.geo && <span className="pill">{p.geo}</span>}
                <span aria-hidden="true" className="text-mute">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
