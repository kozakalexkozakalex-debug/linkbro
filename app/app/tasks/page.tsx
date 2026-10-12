import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { loadMembers } from "@/lib/members";
import { createTask, cycleTask, deleteTask } from "./actions";

type Search = Promise<{ who?: string }>;
type Task = { id: string; project_id: string | null; assignee: string | null; text: string; status: "todo" | "doing" | "done" };

const ST = {
  todo: { label: "До роботи", cls: "" },
  doing: { label: "В роботі", cls: "pill-warn" },
  done: { label: "Готово", cls: "pill-ok" },
} as const;

export default async function TasksPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const all = sp.who === "all";
  const { supabase, team, user } = await getTeamContext();

  let q = supabase.from("tasks").select("id, project_id, assignee, text, status").eq("team_id", team.id);
  if (!all) q = q.eq("assignee", user.id);
  const { data } = await q.order("created_at", { ascending: false }).limit(500);
  const tasks = (data ?? []) as Task[];

  const { data: pData } = await supabase.from("projects").select("id, name").eq("team_id", team.id).order("created_at");
  const projects = (pData ?? []) as { id: string; name: string }[];
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const members = await loadMembers(supabase, team.id);
  const mName = new Map(members.map((m) => [m.id, m.name]));

  const order = { doing: 0, todo: 1, done: 2 };
  tasks.sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">Таски</h1>
          <p className="mt-1 text-mute">Чек-лист замість нотаток. Клік по статусу перемикає його.</p>
        </div>
        <div className="flex gap-1">
          <Link href="/app/tasks" className={`btn btn-sm ${all ? "" : "btn-pri"}`}>Мої</Link>
          <Link href="/app/tasks?who=all" className={`btn btn-sm ${all ? "btn-pri" : ""}`}>Уся команда</Link>
        </div>
      </div>

      <form action={createTask} className="card flex flex-wrap items-end gap-2">
        <div className="field min-w-56 flex-1">
          <label htmlFor="t-text" className="lbl">Що зробити</label>
          <input id="t-text" name="text" className="inp" required maxLength={1000} />
        </div>
        <div className="field">
          <label htmlFor="t-project" className="lbl">Проєкт</label>
          <select id="t-project" name="project_id" className="inp">
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-assignee" className="lbl">Кому</label>
          <select id="t-assignee" name="assignee" className="inp" defaultValue={user.id}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-pri">Додати</button>
      </form>

      <div className="card">
        {tasks.length === 0 ? (
          <p className="text-center text-mute">Тасків немає.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <form action={cycleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value={t.status} />
                  <button type="submit" className={`pill cursor-pointer ${ST[t.status].cls}`}>{ST[t.status].label}</button>
                </form>
                <p className={`min-w-0 flex-1 ${t.status === "done" ? "text-mute line-through" : ""}`}>{t.text}</p>
                {t.project_id && <span className="pill">{pName.get(t.project_id)}</span>}
                {all && t.assignee && <span className="pill">{mName.get(t.assignee) ?? "—"}</span>}
                {team.role === "lead" && (
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="btn btn-sm" aria-label="Видалити">✕</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
