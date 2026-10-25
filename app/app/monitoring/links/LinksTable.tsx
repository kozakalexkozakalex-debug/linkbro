"use client";

// Реєстр посилань: мінімум колонок (домен · проєкт · стан · що не так · перевірено · гарантія · ціна),
// фільтри за станом, пошук, «Перевірити вибрані» порціями по 10 з прогресом. Натиснули рядок — картка на вкладці «Публікація».
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkLinksBatch } from "@/app/app/projects/actions";
import BoardHost from "@/app/app/projects/[id]/BoardHost";
import DonorCard from "@/app/app/projects/[id]/DonorCard";
import { STAGES, STAGE_KEY } from "@/lib/stages";
import { LINK_STATUS, type LinkStatus, type ProjectDonor } from "@/lib/project";
import { noteText } from "@/lib/linkcheck";
import { monState, type MonState } from "@/lib/monitoring";
import { daysLeft, fmtAmount } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

type Filter = "all" | MonState | "guarantee";
const FILTERS: { key: Filter; label: MsgKey }[] = [
  { key: "all", label: "common.all" },
  { key: "problem", label: "ov.fProblem" },
  { key: "suspect", label: "mon.suspect" },
  { key: "tech", label: "ov.fTech" },
  { key: "unchecked", label: "mon.unchecked" },
  { key: "ok", label: "mon.ok" },
  { key: "guarantee", label: "ov.fGuarantee" },
  { key: "nourl", label: "ov.fNoUrl" },
];
const TONE: Record<MonState, string> = { ok: "pill-ok", problem: "pill-bad", suspect: "pill-warn", tech: "", unchecked: "", nourl: "" };
const PER_PAGE = 100;

export default function LinksTable({ rows, projects, initialFilter, initialView }: { rows: ProjectDonor[]; projects: Record<string, string>; initialFilter: string; initialView: "table" | "board" }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [f, setF] = useState<Filter>((FILTERS.some((x) => x.key === initialFilter) ? initialFilter : "all") as Filter);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PER_PAGE);
  const [card, setCard] = useState<ProjectDonor | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const statusOpts = useMemo(() => [...STAGES.map((s) => ({ value: s as string, label: t(STAGE_KEY[s]) })), { value: "lost", label: `✕ ${t(STAGE_KEY.lost)}` }], [t]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, guarantee: 0 };
    for (const d of rows) {
      const s = monState(d);
      c[s] = (c[s] ?? 0) + 1;
      const l = daysLeft(d.guarantee_until);
      if (l != null && l >= 0 && l <= 14) c.guarantee++;
    }
    return c;
  }, [rows]);
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((d) => {
      if (qq && !d.domain.includes(qq)) return false;
      if (f === "all") return true;
      if (f === "guarantee") { const l = daysLeft(d.guarantee_until); return l != null && l >= 0 && l <= 14; }
      return monState(d) === f;
    });
  }, [rows, f, q]);
  const checkable = list.filter((d) => d.article_url);
  const allOn = checkable.length > 0 && checkable.every((d) => sel.has(d.id));

  function runCheck() {
    const ids = [...sel];
    if (!ids.length) return;
    start(async () => {
      const total: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 10) {
        setMsg(t("mon.progress", { n: i, total: ids.length }));
        const r = await checkLinksBatch(ids.slice(i, i + 10));
        for (const [k, v] of Object.entries(r.results)) total[k] = (total[k] ?? 0) + v;
      }
      setMsg(t("ov.checkedSel", { n: ids.length, ok: total.ok ?? 0, s: total.suspect ?? 0 }));
      setSel(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((x) => x.key === "all" || counts[x.key]).map((x) => (
            <button key={x.key} type="button" className={`pill ${f === x.key ? "border-accent text-accent" : ""}`} onClick={() => { setF(x.key); setShown(PER_PAGE); }}>
              {t(x.label)} <span className="font-mono">{counts[x.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="seg ml-auto">
          <button type="button" className={view === "table" ? "seg-on" : ""} onClick={() => setView("table")}>{t("work.table")}</button>
          <button type="button" className={view === "board" ? "seg-on" : ""} onClick={() => setView("board")}>{t("work.kanban")}</button>
        </div>
      </div>

      {view === "board" ? (
        <BoardHost kind="monitor" projectId="" rows={list} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label={t("common.searchDomain")} className="inp w-56 max-sm:w-full" placeholder={t("common.searchDomain")} value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="btn btn-pri" disabled={pending || !sel.size} onClick={runCheck}>↻ {t("ov.checkSel", { n: sel.size })}</button>
            {msg && <span className="text-sm text-mute">{msg}</span>}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label={t("common.all")} checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(checkable.map((d) => d.id)))} /></th>
                  <th>Domain</th>
                  {Object.keys(projects).length > 0 && <th>{t("common.project")}</th>}
                  <th>{t("common.status")}</th>
                  <th>{t("ov.what")}</th>
                  <th>{t("ov.checked")}</th>
                  <th>🛡</th>
                  <th>{t("common.price")}</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, shown).map((d) => {
                  const s = monState(d);
                  const left = daysLeft(d.guarantee_until);
                  const what = s === "suspect" ? `${t((LINK_STATUS[d.link_suspect as LinkStatus] ?? LINK_STATUS[""]).key)} · ${t("ov.recheck")}` : s === "ok" ? "" : d.link_note ? noteText(d.link_note, t) : s === "nourl" ? t("lc.afterUrl") : "";
                  return (
                    <tr key={d.id} className="cursor-pointer" onClick={() => setCard(d)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={d.domain} disabled={!d.article_url} checked={sel.has(d.id)} onChange={() => { const n = new Set(sel); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); setSel(n); }} />
                      </td>
                      <td className="whitespace-nowrap font-mono font-semibold">{d.domain}</td>
                      {Object.keys(projects).length > 0 && <td className="whitespace-nowrap">{projects[d.project_id]}</td>}
                      <td><span className={`pill whitespace-nowrap ${TONE[s]}`}>{s === "nourl" ? "—" : t((LINK_STATUS[d.link_status as LinkStatus] ?? LINK_STATUS[""]).key)}</span></td>
                      <td className="max-w-64 truncate text-sm text-mute" title={what}>{what || "—"}</td>
                      <td className="whitespace-nowrap font-mono text-xs" suppressHydrationWarning>{d.link_checked_at ? new Date(d.link_checked_at).toLocaleString(intl, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className={`whitespace-nowrap font-mono text-xs ${left != null && left >= 0 && left <= 14 ? "text-accent" : ""}`} suppressHydrationWarning>{left == null ? "—" : left < 0 ? t("gp.expired") : t("unit.days", { n: left })}</td>
                      <td className="whitespace-nowrap font-mono text-xs">{d.gp_price == null ? "—" : fmtAmount(d.gp_price, d.gp_currency || "USD", intl)}</td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={8} className="text-center text-mute">{t("common.none")}</td></tr>}
              </tbody>
            </table>
          </div>
          {list.length > shown && (
            <button type="button" className="btn self-center" onClick={() => setShown(shown + PER_PAGE)}>{t("sheet.more", { shown, total: list.length })}</button>
          )}
        </>
      )}
      {card && <DonorCard projectId={card.project_id} donor={card} statusOpts={statusOpts} initialTab="pub" onClose={() => setCard(null)} />}
    </div>
  );
}
