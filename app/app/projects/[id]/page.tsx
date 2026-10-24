import { redirect } from "next/navigation";
import ProjectView, { type SearchValues } from "./ProjectView";

// Страница проекта: Профіль и Історія. Остальное живёт в модулях (Дашборд, Домени, Outreach, Моніторинг).
const MODULE: Record<string, string> = { overview: "/app", pool: "/app/domains", fg: "/app/domains", work: "/app/outreach", core: "/app/outreach", comm: "/app/outreach", gp: "/app/outreach", monitor: "/app/monitoring" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchValues> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";
  if (MODULE[tab]) {
    const next = new URLSearchParams();
    if (sp.q) next.set("q", sp.q);
    if (sp.mine) next.set("mine", sp.mine);
    if (sp.view) next.set("view", sp.view);
    const qs = next.toString();
    redirect(`/app/scope?p=${encodeURIComponent(id)}&next=${encodeURIComponent(MODULE[tab] + (qs ? `?${qs}` : ""))}`);
  }
  return <ProjectView id={id} sp={sp} />;
}
