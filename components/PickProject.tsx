// Разделу нужен проект, а выбрано «Усі проєкти» — карточки проектов для выбора
import ScopeButton from "@/components/ScopeButton";
import Icon from "@/components/Icon";
import { projectDot } from "@/lib/projectColor";

export default function PickProject({ projects, next, text }: { projects: { id: string; name: string }[]; next: string; text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-mute">{text}</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p, i) => (
          <li key={p.id}>
            <ScopeButton p={p.id} next={next} className="proj-pick w-full text-left">
              <span className="picker-dot" style={{ background: projectDot(i) }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <Icon name="arrow" size={14} className="text-mute" />
            </ScopeButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
