// Шапка модуля: название, выбранный проект, вкладки модуля
import ModuleTabs, { MODULE_TABS } from "@/components/ModuleTabs";

export default function ModuleHead({ title, project, module, right }: { title: string; project?: string | null; module?: keyof typeof MODULE_TABS; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {project && <p className="mt-0.5 truncate text-sm text-mute">{project}</p>}
        </div>
        {right}
      </div>
      {module && <ModuleTabs module={module} />}
    </div>
  );
}
