import InferoButton from "@/components/InferoButton";
import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { GLOBAL_COLUMNS, type GlobalDonor } from "@/lib/global";
import GlobalTable, { type Usage } from "./GlobalTable";
import SavedFilters from "./SavedFilters";
import { getI18n } from "@/lib/i18n/server";

type Search = Promise<{ status?: string; q?: string; page?: string; use?: string; dr?: string; tr?: string; sc?: string; geo?: string; tp?: string; fr?: string; sort?: string }>;
const VIEW_COLS = GLOBAL_COLUMNS + ", metrics_at, metrics_source, score, coverage";
const STALE = 90; // дней — метрики «устарели»
// Где домен уже используется (представление global_donors_usage)
const USE = [
  { key: "all", label: "use.all" },
  { key: "free", label: "use.free" },
  { key: "work", label: "use.work" },
  { key: "link", label: "use.link" },
  { key: "nolink", label: "use.nolink" },
] as const;
type UseKey = (typeof USE)[number]["key"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyUse(q: any, use: UseKey) {
  if (use === "free") return q.eq("projects", 0);
  if (use === "work") return q.gt("work", 0);
  if (use === "link") return q.gt("links", 0);
  if (use === "nolink") return q.eq("links", 0);
  return q;
}
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

  const use: UseKey = USE.some((u) => u.key === sp.use) ? (sp.use as UseKey) : "all";
  // Доп. фильтры: минимум DR / трафика / Score, GEO и тематика (содержит), свежесть метрик
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  const ex = {
    dr: num(sp.dr),
    tr: num(sp.tr),
    sc: num(sp.sc),
    geo: (sp.geo ?? "").trim().replace(/[%_,()]/g, "").slice(0, 40),
    tp: (sp.tp ?? "").trim().replace(/[%_,()]/g, "").slice(0, 60),
    fr: sp.fr === "stale" || sp.fr === "none" ? sp.fr : "",
    sort: sp.sort === "score" ? "score" : "",
  };
  const staleIso = new Date(Date.now() - STALE * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyEx = (c: any) => {
    if (q) c = c.ilike("domain", `%${q}%`);
    if (ex.dr != null) c = c.gte("dr", ex.dr);
    if (ex.tr != null) c = c.gte("traffic", ex.tr);
    if (ex.sc != null) c = c.gte("score", ex.sc);
    if (ex.geo) c = c.ilike("geo", `%${ex.geo}%`);
    if (ex.tp) c = c.ilike("topics", `%${ex.tp}%`);
    if (ex.fr === "none") c = c.is("metrics_at", null);
    if (ex.fr === "stale") c = c.lt("metrics_at", staleIso);
    return c;
  };
  const base = () => applyEx(supabase.from("global_donors_usage").select("id", { count: "exact", head: true }).eq("team_id", team.id));
  let query = applyEx(supabase.from("global_donors_usage").select(VIEW_COLS, { count: "exact" }).eq("team_id", team.id));
  if (status !== "all") query = query.eq("status", status);
  query = applyUse(query, use);
  if (ex.sort === "score") query = query.order("score", { ascending: false, nullsFirst: false });

  // Всё параллельно: страница, счётчики статусов (с учётом «где используется») и счётчики «где используется»
  const [{ data, error, count }, statusCounts, useCounts, { data: saved }] = await Promise.all([
    query.order("added_at", { ascending: false }).order("domain").range((page - 1) * PAGE, page * PAGE - 1),
    Promise.all(TABS.map(async (tb) => {
      let c = applyUse(base(), use);
      if (tb.key !== "all") c = c.eq("status", tb.key);
      const { count: n } = await c;
      return [tb.key, n ?? 0] as const;
    })),
    Promise.all(USE.map(async (u) => {
      let c = applyUse(base(), u.key);
      if (status !== "all") c = c.eq("status", status);
      const { count: n } = await c;
      return [u.key, n ?? 0] as const;
    })),
    supabase.from("saved_filters").select("id, name, params").eq("team_id", team.id).order("created_at"),
  ]);
  const savedFilters = (saved ?? []) as { id: string; name: string; params: string }[];
  const rows = (data ?? []) as unknown as GlobalDonor[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const counts: Record<string, number> = Object.fromEntries(statusCounts);
  const ucounts: Record<string, number> = Object.fromEntries(useCounts);

  // По каким проектам ходят домены этой страницы (не больше 100 доменов)
  const usage: Usage = {};
  if (rows.length) {
    const [{ data: pd }, { data: pj }] = await Promise.all([
      supabase.from("project_donors").select("domain, project_id, stage, fg_status").eq("team_id", team.id).in("domain", rows.map((r) => r.domain)),
      supabase.from("projects").select("id, name").eq("team_id", team.id),
    ]);
    const pName = new Map(((pj ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    for (const r of (pd ?? []) as { domain: string; project_id: string; stage: string; fg_status: string }[]) {
      const kind = r.stage === "published" ? "link" : r.fg_status === "out" || r.stage === "lost" ? "out" : r.fg_status === "core" ? "work" : "pool";
      (usage[r.domain] ??= []).push({ name: pName.get(r.project_id) ?? "?", kind });
    }
  }

  const exParams = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (ex.dr != null) p.set("dr", String(ex.dr));
    if (ex.tr != null) p.set("tr", String(ex.tr));
    if (ex.sc != null) p.set("sc", String(ex.sc));
    if (ex.geo) p.set("geo", ex.geo);
    if (ex.tp) p.set("tp", ex.tp);
    if (ex.fr) p.set("fr", ex.fr);
    if (ex.sort) p.set("sort", ex.sort);
    return p;
  };
  const href = (over: { status?: string; page?: number; use?: string }) => {
    const p = exParams();
    const st = over.status ?? status;
    if (st !== "all") p.set("status", st);
    const us = over.use ?? use;
    if (us !== "all") p.set("use", us);
    const pg = over.page ?? 1;
    if (pg > 1) p.set("page", String(pg));
    const s = p.toString();
    return "/app/global" + (s ? `?${s}` : "");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Confero</h1>
          <p className="mt-0.5 text-sm text-mute">{t("dom.conferoSub")}</p>
          <p className="mt-1 max-w-2xl text-mute">
            {t("global.lead")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InferoButton className="btn btn-pri" />
          <a href="/api/export?type=global" className="btn">{t("common.exportCsv")}</a>
        </div>
      </div>

      {/* Фильтры: всё в адресе страницы, поэтому их можно сохранить и открыть одной кнопкой */}
      <form action="/app/global" className="card flex flex-col gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        {use !== "all" && <input type="hidden" name="use" value={use} />}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <input id="gq" name="q" defaultValue={q} className="inp col-span-2" placeholder={t("common.searchDomain")} aria-label={t("common.searchDomain")} />
          <input name="dr" defaultValue={ex.dr ?? ""} inputMode="numeric" className="inp" placeholder="DR ≥" aria-label="DR min" />
          <input name="tr" defaultValue={ex.tr ?? ""} inputMode="numeric" className="inp" placeholder="Traffic ≥" aria-label="Traffic min" />
          <input name="sc" defaultValue={ex.sc ?? ""} inputMode="numeric" className="inp" placeholder="Score ≥" aria-label="Score min" />
          <input name="geo" defaultValue={ex.geo} className="inp" placeholder="GEO" aria-label="GEO" />
          <input name="tp" defaultValue={ex.tp} className="inp" placeholder={t("cf.topic")} aria-label={t("cf.topic")} />
          <select name="fr" defaultValue={ex.fr} className="inp" aria-label={t("mt.fresh")}>
            <option value="">{t("mt.anyFresh")}</option>
            <option value="stale">{t("mt.stale", { n: STALE })}</option>
            <option value="none">{t("mt.none")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="sort" value="score" defaultChecked={ex.sort === "score"} /> {t("cf.sortScore")}
          </label>
          <button type="submit" className="btn btn-pri btn-sm">{t("common.find")}</button>
          {exParams().toString() && <Link href={status === "all" ? "/app/global" : `/app/global?status=${status}`} className="btn btn-sm">{t("common.reset")}</Link>}
          <span className="ml-auto" />
          <SavedFilters saved={savedFilters} current={href({}).replace(/^\/app\/global\??/, "")} />
        </div>
      </form>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((tb) => (
          <Link key={tb.key} href={href({ status: tb.key })} className={`tab ${status === tb.key ? "tab-on" : ""}`}>
            {tb.label || t("common.all")} <span className="font-mono text-xs">{counts[tb.key]}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label={t("use.title")}>
        {USE.map((u) => (
          <Link key={u.key} href={href({ use: u.key })} className={`pill ${use === u.key ? "border-accent text-accent" : ""}`}>
            {t(u.label)} <span className="font-mono">{ucounts[u.key]}</span>
          </Link>
        ))}
      </div>

      {error && <p className="note note-bad">{t("global.loadError", { x: error.message })}</p>}

      <GlobalTable initialRows={rows} usage={usage} />

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
