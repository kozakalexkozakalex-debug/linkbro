import { redirect } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { createProject } from "../actions";
import { NICHES } from "@/lib/project";

type Search = Promise<{ error?: string }>;

export default async function NewProject({ searchParams }: { searchParams: Search }) {
  const { team } = await getTeamContext();
  if (team.role !== "lead") redirect("/app");
  const sp = await searchParams;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-medium">Новий проєкт</h1>
        <p className="mt-1 text-mute">Після створення налаштуйте фільтр метрик і стоп-лист у профілі проєкту.</p>
      </div>
      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}
      <form action={createProject} className="card flex flex-col gap-4">
        <div className="field">
          <label htmlFor="name" className="lbl">Назва</label>
          <input id="name" name="name" className="inp" maxLength={100} required placeholder="Наприклад, SKOGUR" />
        </div>
        <div className="field">
          <label htmlFor="niche" className="lbl">Ніша</label>
          <input id="niche" name="niche" className="inp" list="niches" maxLength={60} placeholder="Оберіть зі списку або впишіть свою" />
          <datalist id="niches">
            {NICHES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="plan" className="lbl">План публікацій на місяць</label>
          <input id="plan" name="plan" type="number" min={0} className="inp" defaultValue={10} />
        </div>
        <div>
          <button type="submit" className="btn btn-pri">Створити проєкт</button>
        </div>
      </form>
    </div>
  );
}
