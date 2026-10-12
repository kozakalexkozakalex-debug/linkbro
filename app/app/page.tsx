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
          Вхід і команда працюють. Наступним кроком тут з&apos;являться Інпут і Глобальна база донорів.
        </p>
        {team.role === "lead" && (
          <p className="mt-3">
            <Link href="/app/team" className="btn btn-pri">Запросити лінкбілдера</Link>
          </p>
        )}
      </div>
    </div>
  );
}
