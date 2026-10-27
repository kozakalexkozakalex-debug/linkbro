import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import WritersTable, { type WriterRow } from "./WritersTable";

// База авторов: кто пишет статьи, почём, на каких языках
export default async function WritersPage() {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const [{ data: w }, { data: used }] = await Promise.all([
    supabase.from("writers").select("id, name, contact, rate, rate_unit, currency, languages, niches, notes").eq("team_id", team.id).order("name"),
    supabase.from("project_donors").select("writer_id").eq("team_id", team.id).not("writer_id", "is", null).limit(10000),
  ]);
  const count = new Map<string, number>();
  for (const r of (used ?? []) as { writer_id: string }[]) count.set(r.writer_id, (count.get(r.writer_id) ?? 0) + 1);
  const rows: WriterRow[] = ((w ?? []) as Omit<WriterRow, "articles">[]).map((r) => ({ ...r, articles: count.get(r.id) ?? 0 }));

  return (
    <div className="flex flex-col gap-5">
      <BaseTabs />
      <div>
        <h1 className="page-title">{t("nav.writers")}</h1>
        <p className="mt-1 max-w-2xl text-mute">{t("wr.lead")}</p>
      </div>
      <WritersTable rows={rows} />
    </div>
  );
}
