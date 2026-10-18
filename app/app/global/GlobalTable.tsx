"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { runCheck, updateGlobalBatch } from "./actions";
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

function ratio(v: (k: string) => string) {
  const tf = Number(v("tf"));
  const cf = Number(v("cf"));
  if (v("tf") === "" || v("cf") === "" || !cf) return "—";
  return (tf / cf).toFixed(2);
}

export default function GlobalTable({ initialRows }: { initialRows: GlobalDonor[] }) {
  const router = useRouter();
  const { t, intl } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MetricFilter>(DEFAULT_FILTER);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [checking, startCheck] = useTransition();

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
    [t, intl],
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

      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="card flex w-full max-w-md flex-col gap-4" role="dialog" aria-label={t("global.filterTitle")}>
            <div>
              <h2 className="font-display text-lg font-medium">{t("global.filterTitle")}</h2>
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
