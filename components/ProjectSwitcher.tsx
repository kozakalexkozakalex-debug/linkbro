"use client";

// Переключатель проекта в меню: «Усі проєкти» или конкретный. Остаётся на текущем модуле.
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

export default function ProjectSwitcher({ projects, current, isLead }: { projects: { id: string; name: string }[]; current: string | null; isLead: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname() ?? "/app";
  const back = path.startsWith("/app/projects/") ? "/app" : path;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="scope" className="side-label">{t("nav.project")}</label>
      <select
        id="scope"
        className="side-select w-full"
        value={current ?? "all"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__new") return router.push("/app/projects/new");
          router.push(`/app/scope?p=${encodeURIComponent(v)}&next=${encodeURIComponent(back)}`);
        }}
      >
        <option value="all">{t("dash.allProjects")}</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        {isLead && <option value="__new">{t("nav.addProject")}</option>}
      </select>
    </div>
  );
}
