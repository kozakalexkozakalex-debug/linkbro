import Link from "next/link";
import { getTeamContext } from "@/lib/team";

export default async function Dashboard() {
  const { team } = await getTeamContext();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-medium">Дашборд</h1>
        <p className="mt-1 text-mute">Команда «{team.name}»</p>
      </div>

      <div className="card">
        <p className="lbl mb-2">Що далі</p>
        <p>
          Почніть з Інпуту: вставте донорів, потім заповніть метрики в Глобальній базі й натисніть CHECK.
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          <Link href="/app/input" className="btn btn-pri">Додати донорів</Link>
          {team.role === "lead" && <Link href="/app/team" className="btn">Запросити лінкбілдера</Link>}
        </p>
      </div>
    </div>
  );
}
