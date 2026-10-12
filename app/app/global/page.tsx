import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { GLOBAL_COLUMNS, type GlobalDonor } from "@/lib/global";
import GlobalTable from "./GlobalTable";

type Search = Promise<{ status?: string }>;
const TABS = [
  { key: "all", label: "Усі" },
  { key: "new", label: "NEW" },
  { key: "fit", label: "FIT" },
  { key: "drop", label: "DROP" },
] as const;

export default async function GlobalPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "all";
  const { supabase, team } = await getTeamContext();

  let query = supabase.from("global_donors").select(GLOBAL_COLUMNS).eq("team_id", team.id);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query.order("added_at", { ascending: false }).order("domain").limit(1000);
  const rows = (data ?? []) as unknown as GlobalDonor[];

  const counts: Record<string, number> = {};
  await Promise.all(
    TABS.map(async (t) => {
      let q = supabase.from("global_donors").select("id", { count: "exact", head: true }).eq("team_id", team.id);
      if (t.key !== "all") q = q.eq("status", t.key);
      const { count } = await q;
      counts[t.key] = count ?? 0;
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">Глобальна база</h1>
          <p className="mt-1 max-w-2xl text-mute">
            Метрики вносяться вручну з Ahrefs / Majestic. Зміни зберігаються, щойно ви виходите з клітинки.
          </p>
        </div>
        <Link href="/app/input" className="btn">+ Додати донорів</Link>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/app/global" : `/app/global?status=${t.key}`}
            className={`tab ${status === t.key ? "tab-on" : ""}`}
          >
            {t.label} <span className="font-mono text-xs">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {error && <p className="note note-bad">Не вдалося завантажити базу: {error.message}</p>}
      {rows.length >= 1000 && (
        <p className="note note-bad">Показано перші 1000 донорів. Пошук і сторінки додамо пізніше.</p>
      )}

      <GlobalTable initialRows={rows} />
    </div>
  );
}
