// Разделу нужен проект, а выбрано «Усі проєкти» — карточки проектов для выбора
import Link from "next/link";
import Icon from "@/components/Icon";
import { projectDot } from "@/lib/projectColor";

export default function PickProject({ projects, next, text }: { projects: { id: string; name: string }[]; next: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-mute">{text}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p, i) => (
          <li key={p.id}>
            <Link href={`/app/scope?p=${p.id}&next=${encodeURIComponent(next)}`} className="proj-pick">
              <span className="picker-dot" style={{ background: projectDot(i) }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <Icon name="arrow" size={14} className="text-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
