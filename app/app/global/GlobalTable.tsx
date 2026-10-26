"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMetricHistory, runCheck, updateGlobalBatch, type MetricSnap } from "./actions";
import { isStale, scoreTone } from "@/lib/score";
import { transferToProjects } from "../projects/actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { useI18n } from "@/components/I18nProvider";
import { DEFAULT_FILTER, METRICS, fmtDate, fmtDateTime, type GlobalDonor, type MetricFilter } from "@/lib/global";

const STATUS = {
  new: { label: "NEW", cls: "" },
  fit: { label: "FIT", cls: "pill-ok" },
  drop: { label: "DROP", cls: "pill-bad" },
} as const;

const FILTER_KEY = "linkbro.globalFilter";

// Где домен уже используется: link — наш линк опубликован, work — в Outreach, pool — в Prefero, out — не підійшов
export type Usage = Record<string, { name: string; kind: "link" | "work" | "pool" | "out" }[]>;
const USE_ICON = { link: "🔗", work: "✉", pool: "○", out: "✕" } as const;

function ratio(v: (k: string) => string) {
  const tf = Number(v("tf"));
  const cf = Number(v("cf"));
  if (v("tf") === "" || v("cf") === "" || !cf) return "—";
  return (tf / cf).toFixed(2);
}

export default function GlobalTable({ initialRows, usage = {} }: { initialRows: GlobalDonor[]; usage?: Usage }) {
  const router = useRouter();
  const { t, intl } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MetricFilter>(DEFAULT_FILTER);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [checking, startCheck] = useTransition();
  const [hist, setHist] = useState<{ id: string; domain: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (saved) setFilter({ ...DEFAULT_FILTER, ...JSON.parse(saved) });
    } catch {
      /* без сохранённого фильтра */
    }
  }, []);

  const columns: SheetCol<GlobalDonor>[] = useMemo(
    () => [
      { key: "domain", header: "Domain", kind: "readonly", width: 170, render: (d) => <span className="font-mono font-semibold whitespace-nowrap">{d.domain}</span> },
      {
        key: "added_at",
        header: "Date Added",
        kind: "readonly",
        width: 130,
        render: (d) => (
          <span className={`date-chip ${d.batch % 2 ? "date-odd" : "date-even"}`} title={t("global.batch", { n: d.batch })}>{fmtDateTime(d.added_at, intl)}</span>
        ),
      },
      {
        key: "used",
        header: t("use.col"),
        kind: "readonly",
        width: 150,
        render: (d) => {
          const u = usage[d.domain] ?? [];
          if (!u.length) return <span className="text-xs text-mute">—</span>;
          return (
            <span className="flex flex-wrap gap-1" title={u.map((x) => `${USE_ICON[x.kind]} ${x.name}`).join("\n")}>
              {u.slice(0, 3).map((x, i) => (
                <span key={i} className={`pill whitespace-nowrap text-[11px] ${x.kind === "link" ? "pill-ok" : x.kind === "out" ? "text-mute" : ""}`}>
                  {USE_ICON[x.kind]} {x.name}
                </span>
              ))}
              {u.length > 3 && <span className="text-xs text-mute">+{u.length - 3}</span>}
            </span>
          );
        },
      },
      {
        key: "score",
        header: "Score",
        kind: "readonly",
        width: 62,
        render: (d) =>
          d.score == null ? (
            <span className="text-xs text-mute">—</span>
          ) : (
            <span className={`font-mono font-semibold ${scoreTone(d.score)}`} title={t("cf.coverage", { n: d.coverage ?? 0 })}>
              {(d.coverage ?? 100) < 60 ? "≈" : ""}{d.score}
            </span>
          ),
      },
      {
        key: "metrics_at",
        header: t("mt.updated"),
        kind: "readonly",
        width: 110,
        render: (d) =>
          !d.metrics_at ? (
            <span className="text-xs text-accent">{t("mt.none")}</span>
          ) : (
            <button type="button" className={`whitespace-nowrap text-left text-xs underline decoration-dotted ${isStale(d.metrics_at) ? "text-accent" : "text-mute"}`} onClick={() => setHist({ id: d.id, domain: d.domain })} title={t("mt.history")}>
              {fmtDate(d.metrics_at, intl)}{d.metrics_source ? ` · ${d.metrics_source}` : ""}
            </button>
          ),
      },
      { key: "dr", header: "DR", kind: "number", width: 60, mono: true },
      { key: "keywords", header: "Keywords", kind: "number", width: 80, mono: true },
      { key: "traffic", header: "Traffic", kind: "number", width: 80, mono: true },
      { key: "geo", header: "GEO", kind: "text", width: 70 },
      { key: "topics", header: "Topics", kind: "text", width: 130 },
      { key: "tf", header: "TF", kind: "number", width: 55, mono: true },
      { key: "cf", header: "CF", kind: "number", width: 55, mono: true },
      { key: "ratio", header: "TF/CF", kind: "readonly", width: 60, render: (_d, v) => <span className="font-mono">{ratio(v)}</span> },
      { key: "price", header: "Price", kind: "text", width: 120 },
      {
        key: "status",
        header: "Status",
        kind: "readonly",
        width: 70,
        render: (d) => (
          <span className={`pill ${STATUS[d.status].cls}`} title={d.checked_at ? t("global.checkedAt", { date: fmtDate(d.checked_at, intl) }) : t("global.notChecked")}>
            {STATUS[d.status].label}
          </span>
        ),
      },
    ],
    [t, intl, usage],
  );

  function check() {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      /* не страшно */
    }
    startCheck(async () => {
      const r = await runCheck(filter);
      setOpen(false);
      if (r.error) setMsg({ text: t("global.checkError", { x: r.error }), bad: true });
      else setMsg({ text: t("global.checkResult", { fit: r.fit, drop: r.drop, skipped: r.skipped }) });
      router.refresh();
    });
  }

  function transfer() {
    startCheck(async () => {
      const r = await transferToProjects();
      if (r.error) setMsg({ text: t("global.transferError", { x: r.error }), bad: true });
      else if (r.report.length === 0) setMsg({ text: t("global.needProject"), bad: true });
      else
        setMsg({
          text:
            t("global.transferred") + " " +
            r.report.map((p) => t("global.transferRow", { name: p.name, added: p.added, filtered: p.filtered, stopped: p.stopped })).join(" · ") +
            (r.report.some((p) => p.filtered > 0) ? ". " + t("global.filterInProfile") : ""),
        });
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-pri" onClick={() => setOpen(true)}>CHECK</button>
        <button type="button" className="btn" onClick={transfer} disabled={checking}>
          {t("global.transfer")}
        </button>
      </div>

      {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`} role="status">{msg.text}</p>}

      <Sheet
        rows={initialRows}
        columns={columns}
        onSave={(changes) => updateGlobalBatch(changes)}
        refreshAfterSave={false}
        empty={
          <div className="card text-center text-mute">
            {t("global.empty")} <Link href="/app/input" className="underline">{t("global.emptyInput")}</Link> {t("common.or")}{" "}
            <Link href="/app/import" className="underline">{t("global.emptyImport")}</Link>.
          </div>
        }
      />

      {hist && <MetricHistory donor={hist} onClose={() => setHist(null)} />}
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="card flex w-full max-w-md flex-col gap-4" role="dialog" aria-label={t("global.filterTitle")}>
            <div>
              <h2 className="font-display text-lg font-semibold">{t("global.filterTitle")}</h2>
              <p className="mt-1 text-sm text-mute">
                {t("global.filterHint")}
              </p>
            </div>
            <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
              <span />
              <span className="lbl">Min</span>
              <span className="lbl">Max</span>
              {METRICS.map((m) => (
                <div key={m.key} className="contents">
                  <b className="text-sm">{m.label}</b>
                  {(["min", "max"] as const).map((edge) => (
                    <input
                      key={edge}
                      id={`f-${m.key}-${edge}`}
                      aria-label={`${m.label} ${edge}`}
                      inputMode="decimal"
                      className="inp"
                      value={filter[m.key][edge]}
                      onChange={(e) => setFilter({ ...filter, [m.key]: { ...filter[m.key], [edge]: e.target.value } })}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-pri" onClick={check} disabled={checking}>
                {checking ? t("global.checking") : t("common.run")}
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// История метрик домена: что было раньше и откуда (сохраняется при каждом обновлении)
function MetricHistory({ donor, onClose }: { donor: { id: string; domain: string }; onClose: () => void }) {
  const { t, intl } = useI18n();
  const [rows, setRows] = useState<MetricSnap[] | null>(null);
  useEffect(() => {
    getMetricHistory(donor.id).then(setRows).catch(() => setRows([]));
  }, [donor.id]);
  const n = (v: number | null) => (v == null ? "—" : String(v));
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex w-full max-w-lg flex-col gap-3" role="dialog" aria-label={t("mt.history")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-lg font-semibold">{donor.domain}</p>
            <p className="text-sm text-mute">{t("mt.historyHint")}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>
        {!rows ? (
          <p className="text-mute">…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-mute">{t("mt.noHistory")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{t("mt.updated")}</th><th>DR</th><th>Traffic</th><th>KW</th><th>TF</th><th>CF</th><th>{t("mt.source")}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{fmtDate(r.taken_at, intl)}</td>
                    <td className="font-mono">{n(r.dr)}</td>
                    <td className="font-mono">{n(r.traffic)}</td>
                    <td className="font-mono">{n(r.keywords)}</td>
                    <td className="font-mono">{n(r.tf)}</td>
                    <td className="font-mono">{n(r.cf)}</td>
                    <td className="text-xs text-mute">{r.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
