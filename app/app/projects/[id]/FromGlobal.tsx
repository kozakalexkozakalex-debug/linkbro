"use client";

// Prefero — таблица доменов проекта с воронкой проверки:
// метрики (автоматично) → GEO (автоматично, можна виправити) → Тема → Category page.
// Не підійшле лишається тут з причиною — це й стоп-лист проєкту: з Confero вдруге не прийде.
import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setPreferoCheck, updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { BulkButton } from "@/components/BulkTools";
import { metricCols } from "@/components/MetricCols";
import { fmtDate, type MetricFilter } from "@/lib/global";
import { CHECK_KEYS, checkMark, metricLines, verdict, type CheckKey, type Mark, type Verdict } from "@/lib/prefero";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";
import { normWeights, qualityScore, scoreTone } from "@/lib/score";
import type { MsgKey } from "@/lib/i18n/config";

const ICON: Record<Mark, string> = { ok: "✓", no: "✕", "?": "?" };
const TONE: Record<Mark, string> = { ok: "text-ok", no: "text-bad", "?": "text-mute" };
const CHECK_LABEL: Record<CheckKey, MsgKey> = { geo: "pref.geo", topic: "pref.topic", category: "pref.category" };
const SHORT: Record<CheckKey, string> = { geo: "GEO", topic: "Тема", category: "Cat" };
type Filter = "all" | "check" | "fit" | "work" | "out" | `out:${string}`;

export default function FromGlobal({
  projectId,
  rows,
  stopTools,
  stopGlobal,
  projectGeo = "",
  filter,
  weights,
}: {
  projectId: string;
  rows: ProjectDonor[];
  stopTools: number;
  stopGlobal: number;
  projectGeo?: string;
  filter: MetricFilter;
  weights?: unknown;
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [, start] = useTransition();
  const toWork = useCallback(
    (id: string) =>
      start(async () => {
        await updateDonorsBatch(projectId, [{ id, field: "fg_status", value: "core" }]);
        router.refresh();
      }),
    [projectId, router],
  );
  const [open, setOpen] = useState<ProjectDonor | null>(null);
  const [show, setShow] = useState<Filter>("all");

  const w = useMemo(() => normWeights(weights), [weights]);
  const verdicts = useMemo(() => new Map(rows.map((d) => [d.id, verdict(d, filter, projectGeo)])), [rows, filter, projectGeo]);
  const reasonOf = (v: Verdict) => (v.failed === "manual" ? "manual" : v.failed ?? "");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, check: 0, fit: 0, work: 0, out: 0 };
    for (const v of verdicts.values()) {
      c[v.status]++;
      if (v.status === "out") c[`out:${reasonOf(v)}`] = (c[`out:${reasonOf(v)}`] ?? 0) + 1;
    }
    return c;
  }, [rows.length, verdicts]);
  const shown = useMemo(
    () =>
      rows.filter((d) => {
        const v = verdicts.get(d.id)!;
        if (show === "all") return true;
        if (show.startsWith("out:")) return v.status === "out" && reasonOf(v) === show.slice(4);
        return v.status === show;
      }),
    [rows, verdicts, show],
  );

  const reasonLabel = (r: string) => (r === "manual" ? t("pref.manual") : CHECK_KEYS.includes(r as CheckKey) ? t(CHECK_LABEL[r as CheckKey]) : r);

  const columns: SheetCol<ProjectDonor>[] = useMemo(
    () => [
      { key: "domain", header: "Domain", kind: "readonly", width: 170, render: (d) => <span className="font-mono font-semibold whitespace-nowrap">{d.domain}</span> },
      { key: "added", header: "Date Added", kind: "readonly", width: 90, mono: true, get: (d) => fmtDate(d.added_at, intl) },
      {
        key: "score",
        header: "Score",
        kind: "readonly",
        width: 62,
        render: (d) => {
          const q = qualityScore(d.global_donors, w);
          return q.score == null ? <span className="text-xs text-mute">—</span> : <span className={`font-mono font-semibold ${scoreTone(q.score)}`} title={t("cf.coverage", { n: q.coverage })}>{q.coverage < 60 ? "≈" : ""}{q.score}</span>;
        },
      },
      ...metricCols(),
      { key: "category_page", header: "Category Page", kind: "text", width: 170, placeholder: "/blog/…" },
      {
        key: "checks",
        header: t("pref.funnel"),
        kind: "readonly",
        width: 360,
        render: (d) => <Path d={d} filter={filter} projectGeo={projectGeo} onOpen={() => setOpen(d)} />,
      },
      {
        key: "verdict",
        header: t("common.status"),
        kind: "readonly",
        width: 170,
        render: (d) => {
          const v = verdicts.get(d.id)!;
          if (v.status === "work" && v.incomplete)
            return (
              <button type="button" className="pill pill-warn whitespace-nowrap" onClick={() => setOpen(d)} title={t("pref.incomplete")}>
                ! Outreach · {t("pref.missing")}: {[...(v.failed ? [v.failed as CheckKey] : []), ...v.pending].map((k) => SHORT[k]).join(", ")}
              </button>
            );
          if (v.status === "work") return <span className="pill pill-ok whitespace-nowrap">✓ {t("pool.core")}</span>;
          // Всё зелёное, но домен отметили ещё до автоперехода — одна кнопка, чтобы отправить
          if (v.status === "fit")
            return (
              <button type="button" className="btn btn-pri btn-sm whitespace-nowrap" onClick={() => toWork(d.id)}>
                {t("pool.toWork")}
              </button>
            );
          if (v.status === "out") return <span className="pill pill-bad whitespace-nowrap">✕ {reasonLabel(reasonOf(v))}</span>;
          return (
            <button type="button" className="pill whitespace-nowrap" onClick={() => setOpen(d)}>
              ? {t("pref.toCheck")}: {v.pending.map((k) => SHORT[k]).join(", ")}
            </button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intl, t, verdicts, projectGeo, filter, toWork, w],
  );

  const setAll = (ids: string[], value: string) => updateDonorsBatch(projectId, ids.map((id) => ({ id, field: "fg_status", value })));
  const chip = (k: Filter, label: string) =>
    counts[k] ? (
      <button key={k} type="button" className={`pill ${show === k ? "border-accent text-accent" : ""}`} onClick={() => setShow(k)}>
        {label} <span className="font-mono">{counts[k]}</span>
      </button>
    ) : null;

  return (
    <>
      <p className="text-sm text-mute">
        {t("pref.lead")} {t("fg.stops", { tools: stopTools, global: stopGlobal })} ·{" "}
        <Link href="/app/settings" className="underline">{t("fg.configure")}</Link>
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={`pill ${show === "all" ? "border-accent text-accent" : ""}`} onClick={() => setShow("all")}>
          {t("common.all")} <span className="font-mono">{counts.all}</span>
        </button>
        {chip("check", t("pref.toCheck"))}
        {chip("fit", t("pool.fit"))}
        {chip("work", t("pool.core"))}
        {chip("out", t("pool.out"))}
        {[...CHECK_KEYS, "manual"].map((r) => chip(`out:${r}`, `✕ ${reasonLabel(r)}`))}
      </div>
      <Sheet
        rows={shown}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkButton label={t("pool.toWork")} onApply={() => setAll(ids, "core")} />
            <BulkButton label={`✕ ${t("pool.out")}`} onApply={() => setAll(ids, "out")} />
          </>
        )}
        empty={
          <div className="card text-center text-mute">
            {t("fg.empty")}{" "}
            <Link href="/app/global?status=fit" className="underline">Confero</Link>.
          </div>
        }
      />
      {open && (
        <FunnelDialog
          donor={rows.find((r) => r.id === open.id) ?? open}
          projectId={projectId}
          projectGeo={projectGeo}
          filter={filter}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

// Путь домена одной линией: точки = этапы, зелёная — пройдено, красная — не подошло, серая — ещё не проверено.
// Последняя точка — Outreach: загорается, когда домен ушёл в работу.
function Path({ d, filter, projectGeo, onOpen }: { d: ProjectDonor; filter: MetricFilter; projectGeo: string; onOpen: () => void }) {
  const { t } = useI18n();
  const metrics = metricLines(d.global_donors, filter);
  const v = verdict(d, filter, projectGeo);
  const steps: { label: string; mark: Mark | "warn"; title: string }[] = [
    ...metrics.map((l) => ({
      label: l.label === "Keywords" ? "KW" : l.label === "Traffic" ? "Tr" : l.label,
      // метрики уже прошли при попадании в проект; ⚠ — если фильтр проекта потом ужесточили
      mark: (l.mark === "no" ? "warn" : "ok") as Mark | "warn",
      title: `${l.label}: ${l.value ?? "—"}`,
    })),
    ...CHECK_KEYS.map((k) => ({ label: SHORT[k], mark: checkMark(d, k, projectGeo) as Mark | "warn", title: t(CHECK_LABEL[k]) })),
    // Outreach горит зелёным, только если все этапы до него зелёные
    { label: "Outreach", mark: (v.status === "work" ? (v.incomplete ? "warn" : "ok") : v.status === "out" ? "no" : "?") as Mark | "warn", title: v.incomplete ? t("pref.incomplete") : "Outreach" },
  ];
  const color = (m: Mark | "warn") => (m === "ok" ? "var(--ok)" : m === "no" ? "var(--bad)" : m === "warn" ? "var(--accent)" : "var(--line-strong)");
  return (
    <button type="button" className="path" onClick={onOpen} title={t("pref.openFunnel")} aria-label={t("pref.openFunnel")}>
      {steps.map((s, i) => (
        <span key={s.label} className="path-step" title={s.title}>
          {i > 0 && <span className="path-line" style={{ background: steps[i - 1].mark === "ok" ? "var(--ok)" : "var(--line-strong)" }} />}
          <span className="path-dot" style={{ background: s.mark === "?" ? "transparent" : color(s.mark), borderColor: color(s.mark) }}>
            {s.mark === "no" ? "✕" : s.mark === "ok" ? "✓" : s.mark === "warn" ? "!" : ""}
          </span>
          <span className={`path-label ${s.mark === "no" ? "text-bad" : s.mark === "?" ? "text-mute" : ""}`}>{s.label}</span>
        </span>
      ))}
    </button>
  );
}

// Окошко «вся воронка»: метрики со значениями против фильтра проекта + ручные чекпоинты
function FunnelDialog({ donor, projectId, projectGeo, filter, onClose }: { donor: ProjectDonor; projectId: string; projectGeo: string; filter: MetricFilter; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const lines = metricLines(donor.global_donors, filter);
  const v = verdict(donor, filter, projectGeo);
  const g = donor.global_donors;
  const range = (min: number | null, max: number | null) => (min != null && max != null ? `${min}–${max}` : min != null ? `≥ ${min}` : max != null ? `≤ ${max}` : t("pref.any"));
  const set = (k: CheckKey, value: "ok" | "no" | "") =>
    start(async () => {
      const r = await setPreferoCheck(donor.id, projectId, k, value);
      if (!r.ok) return setErr(r.error ?? t("common.error"));
      router.refresh();
    });
  const detail: Record<CheckKey, string> = {
    geo: `${g?.geo || "—"} · ${t("pref.projectGeo", { x: projectGeo || "—" })}`,
    topic: g?.topics || "—",
    category: donor.category_page || t("pref.noCategory"),
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex w-full max-w-lg flex-col gap-3" role="dialog" aria-label={t("pref.funnel")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-lg font-semibold">{donor.domain}</p>
            <p className="text-sm text-mute">
              {v.status === "out"
                ? t("pref.failedAt", { x: v.failed === "manual" ? t("pref.manual") : t(CHECK_LABEL[v.failed as CheckKey]) })
                : v.status === "check"
                  ? t("pref.left", { x: v.pending.map((k) => t(CHECK_LABEL[k])).join(", ") })
                  : v.status === "work"
                    ? t("pool.core")
                    : t("pref.allOk")}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>

        <div>
          <p className="lbl mb-1">{t("pref.metricsAuto")}</p>
          <ul className="divide-y divide-line text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 py-1.5">
                <span className="w-16 font-medium">{l.label}</span>
                <span className="font-mono">{l.value ?? "—"}</span>
                <span className="text-xs text-mute">{range(l.min, l.max)}</span>
                <span className={`ml-auto font-mono ${l.mark === "no" ? "text-accent" : TONE[l.mark]}`} title={l.mark === "no" ? t("pref.filterChanged") : undefined}>
                  {l.mark === "no" ? "⚠" : ICON[l.mark]}
                </span>
              </li>
            ))}
          </ul>
          {v.metricsBad.length > 0 && <p className="mt-1 text-xs text-accent">{t("pref.filterChanged")}</p>}
        </div>

        <div>
          <p className="lbl mb-1">{t("pref.manualChecks")}</p>
          <ul className="divide-y divide-line text-sm">
            {CHECK_KEYS.map((k, i) => {
              const m = checkMark(donor, k, projectGeo);
              const manual = donor.checks?.[k];
              return (
                <li key={k} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-5 text-mute">{i + 2}.</span>
                  <span className="w-28 font-medium">{t(CHECK_LABEL[k])}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-mute" title={detail[k]}>{detail[k]}</span>
                  <span className={`font-mono ${TONE[m]}`}>{ICON[m]}</span>
                  <span className="inline-flex gap-1">
                    <button type="button" className={`btn btn-sm ${manual === "ok" ? "btn-pri" : ""}`} disabled={pending} onClick={() => set(k, manual === "ok" ? "" : "ok")} aria-label={`${t(CHECK_LABEL[k])} ✓`}>✓</button>
                    <button type="button" className={`btn btn-sm ${manual === "no" ? "btn-pri" : ""}`} disabled={pending} onClick={() => set(k, manual === "no" ? "" : "no")} aria-label={`${t(CHECK_LABEL[k])} ✕`}>✕</button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-mute">{t("pref.autoHint")}</p>
        </div>
        {err && <p className="note note-bad">{err}</p>}
      </div>
    </div>
  );
}
