import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { GLOBAL_COLUMNS, type GlobalDonor } from "@/lib/global";
import GlobalTable from "./GlobalTable";

type Search = Promise<{ status?: string; q?: string; page?: string }>;
const TABS = [
  { key: "all", label: "Усі" },
  { key: "new", label: "NEW" },
  { key: "fit", label: "FIT" },
  { key: "drop", label: "DROP" },
] as const;
const PAGE = 100;

export default async function GlobalPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "all";
  const q = (sp.q ?? "").trim().toLowerCase().replace(/[%_]/g, "");
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { supabase, team } = await getTeamContext();

  let query = supabase.from("global_donors").select(GLOBAL_COLUMNS, { count: "exact" }).eq("team_id", team.id);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("domain", `%${q}%`);
  const { data, error, count } = await query
    .order("added_at", { ascending: false })
    .order("domain")
    .range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as unknown as GlobalDonor[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const counts: Record<string, number> = {};
  await Promise.all(
    TABS.map(async (t) => {
      let c = supabase.from("global_donors").select("id", { count: "exact", head: true }).eq("team_id", team.id);
      if (t.key !== "all") c = c.eq("status", t.key);
      if (q) c = c.ilike("domain", `%${q}%`);
      const { count: n } = await c;
      counts[t.key] = n ?? 0;
    }),
  );

  const href = (over: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    const st = over.status ?? status;
    if (st !== "all") p.set("status", st);
    if (q) p.set("q", q);
    const pg = over.page ?? 1;
    if (pg > 1) p.set("page", String(pg));
    const s = p.toString();
    return "/app/global" + (s ? `?${s}` : "");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">Глобальна база</h1>
          <p className="mt-1 max-w-2xl text-mute">
            Метрики вносяться вручну з Ahrefs / Majestic або імпортом CSV. Зміни зберігаються, щойно ви виходите з клітинки.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/input" className="btn">+ Додати донорів</Link>
          <Link href="/app/import" className="btn">Імпорт CSV</Link>
          <a href="/api/export?type=global" className="btn">Експорт CSV</a>
        </div>
      </div>

      <form action="/app/global" className="flex flex-wrap gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label htmlFor="gq" className="sr-only">Пошук домену</label>
        <input id="gq" name="q" defaultValue={q} className="inp max-w-xs" placeholder="пошук домену" />
        <button type="submit" className="btn">Знайти</button>
        {q && <Link href={status === "all" ? "/app/global" : `/app/global?status=${status}`} className="btn">Скинути</Link>}
      </form>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ status: t.key })} className={`tab ${status === t.key ? "tab-on" : ""}`}>
            {t.label} <span className="font-mono text-xs">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {error && <p className="note note-bad">Не вдалося завантажити базу: {error.message}</p>}

      <GlobalTable initialRows={rows} />

      {pages > 1 && (
        <nav className="flex flex-wrap items-center gap-2" aria-label="Сторінки">
          {page > 1 && <Link href={href({ page: page - 1 })} className="btn btn-sm">← Назад</Link>}
          <span className="font-mono text-sm text-mute">
            {page} / {pages} · усього {total}
          </span>
          {page < pages && <Link href={href({ page: page + 1 })} className="btn btn-sm">Далі →</Link>}
        </nav>
      )}
    </div>
  );
}
