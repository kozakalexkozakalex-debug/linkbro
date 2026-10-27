// Заголовок страницы: название, короткое пояснение (по желанию), действия справа, вкладки раздела.
// Проект показывается в верхней панели, поэтому здесь он не повторяется.
import ModuleTabs, { MODULE_TABS } from "@/components/ModuleTabs";

export default function ModuleHead({
  title,
  hint,
  module,
  right,
}: {
  title: string;
  hint?: string | null;
  /** устарело: проект теперь в верхней панели */
  project?: string | null;
  module?: keyof typeof MODULE_TABS;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="page-title">{title}</h1>
          {hint && <p className="text-sm text-mute">{hint}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {module && <ModuleTabs module={module} />}
    </div>
  );
}
