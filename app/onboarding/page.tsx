import { redirect } from "next/navigation";
import { createTeam } from "@/app/actions/team";
import { signOut } from "@/app/actions/auth";
import { listMyTeams } from "@/lib/team";

type Search = Promise<{ error?: string }>;

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const teams = await listMyTeams();
  if (teams.length > 0) redirect("/app");
  const sp = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <p className="font-display text-2xl font-bold tracking-tight">
        Link<span className="text-accent">Bro</span>
      </p>
      <div>
        <h1 className="font-display text-xl font-medium">Створіть команду</h1>
        <p className="mt-1 text-mute">
          Ви станете її тімлідом і зможете запросити лінкбілдерів. Якщо вас запросили, просто відкрийте посилання із запрошення.
        </p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}

      <form action={createTeam} className="card flex flex-col gap-4">
        <div className="field">
          <label htmlFor="name" className="lbl">Назва команди</label>
          <input id="name" name="name" className="inp" placeholder="Наприклад, SEO Team Lviv" maxLength={100} required />
        </div>
        <button type="submit" className="btn btn-pri">Створити команду</button>
      </form>

      <form action={signOut}>
        <button type="submit" className="text-sm text-mute underline">Вийти з акаунта</button>
      </form>
    </main>
  );
}
