import BaseTabs from "@/components/BaseTabs";
import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { GLOBAL_COLUMNS, type GlobalDonor } from "@/lib/global";
import GlobalTable from "./GlobalTable";
import { getI18n } from "@/lib/i18n/server";

type Search = Promise<{ status?: string; q?: string; page?: string }>;
const TABS = [
  { key: "all", label: "" },
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
  const { t } = await getI18n();

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
      <BaseTabs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.global")}</h1>
          <p className="mt-1 max-w-2xl text-mute">
            {t("global.lead")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/input" className="btn">{t("global.addDonors")}</Link>
          <Link href="/app/import" className="btn">{t("nav.import")}</Link>
          <a href="/api/export?type=global" className="btn">{t("common.exportCsv")}</a>
        </div>
      </div>

      <form action="/app/global" className="flex flex-wrap gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label htmlFor="gq" className="sr-only">{t("common.searchDomain")}</label>
        <input id="gq" name="q" defaultValue={q} className="inp max-w-xs" placeholder={t("common.searchDomain")} />
        <button type="submit" className="btn">{t("common.find")}</button>
        {q && <Link href={status === "all" ? "/app/global" : `/app/global?status=${status}`} className="btn">{t("common.reset")}</Link>}
      </form>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tb) => (
          <Link key={tb.key} href={href({ status: tb.key })} className={`tab ${status === tb.key ? "tab-on" : ""}`}>
            {tb.label || t("common.all")} <span className="font-mono text-xs">{counts[tb.key]}</span>
          </Link>
        ))}
      </div>

      {error && <p className="note note-bad">{t("global.loadError", { x: error.message })}</p>}

      <GlobalTable initialRows={rows} />

      {pages > 1 && (
        <nav className="flex flex-wrap items-center gap-2" aria-label={t("common.pages")}>
          {page > 1 && <Link href={href({ page: page - 1 })} className="btn btn-sm">{t("common.prev")}</Link>}
          <span className="font-mono text-sm text-mute">
            {page} / {pages} · {t("common.total", { n: total })}
          </span>
          {page < pages && <Link href={href({ page: page + 1 })} className="btn btn-sm">{t("common.next")}</Link>}
        </nav>
      )}
    </div>
  );
}
