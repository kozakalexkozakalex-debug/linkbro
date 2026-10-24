// Если модулю нужен проект, а выбрано «Усі проєкти» — список проектов для выбора
import Link from "next/link";
import Chevron from "@/components/Chevron";

export default function PickProject({ projects, next, text }: { projects: { id: string; name: string }[]; next: string; text: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <p className="text-mute">{text}</p>
      <ul className="flex flex-col gap-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/app/scope?p=${p.id}&next=${encodeURIComponent(next)}`} className="flex items-center gap-2 rounded-xl border border-line bg-elev px-4 py-3 hover:border-accent">
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <Chevron className="text-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
