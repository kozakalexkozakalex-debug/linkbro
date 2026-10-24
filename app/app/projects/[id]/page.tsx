import { redirect } from "next/navigation";
import type { SearchValues } from "./ProjectView";

// Старые адреса проекта ведут в разделы проекта (выбранный проект хранится в cookie).
// Профіль і Історія теперь в «Налаштування проєкту»; «saved» / «error» после форм сохраняются.
const MODULE: Record<string, string> = {
  overview: "/app",
  pool: "/app/domains",
  fg: "/app/domains",
  work: "/app/outreach",
  core: "/app/outreach",
  comm: "/app/outreach",
  gp: "/app/outreach",
  monitor: "/app/monitoring",
  profile: "/app/settings",
  history: "/app/settings",
};

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchValues> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab && MODULE[sp.tab] ? sp.tab : "overview";
  const next = new URLSearchParams();
  if (tab === "history") next.set("tab", "history");
  for (const k of ["q", "mine", "view", "saved", "error"] as const) if (sp[k]) next.set(k, sp[k] as string);
  const qs = next.toString();
  redirect(`/app/scope?p=${encodeURIComponent(id)}&next=${encodeURIComponent(MODULE[tab] + (qs ? `?${qs}` : ""))}`);
}
