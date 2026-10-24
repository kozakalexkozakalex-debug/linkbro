"use client";

// Одна рабочая таблица проекта: Project Core + Communication + Guest Posting.
// Колонки собраны в группы, ненужные группы можно скрыть (удобно на телефоне).
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findIntermediaries, markContacted, updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { AddStatus, BulkSelect } from "@/components/BulkTools";
import CopyButton from "@/components/CopyButton";
import DupeBadge from "@/components/DupeBadge";
import LinkCheck from "@/components/LinkCheck";
import { metricCols } from "@/components/MetricCols";
import { fmtDate } from "@/lib/global";
import { CORE_NEG, CORE_POS, GP_STATUSES, INDICATORS, ageLabel, hoursSince, type CustomStatuses, type Member, type ProjectDonor } from "@/lib/project";
import { CURRENCIES, PAY_STATUSES, SOURCES, daysLeft, fmtAmount, payState, priceFromText } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";
import Kanban from "./Kanban";
import DonorCard from "./DonorCard";
import type { MsgKey } from "@/lib/i18n/config";

export type MedBusy = Record<string, { donorId: string; assignee: string | null; label: string }[]>;

const GROUPS = ["metrics", "med", "prices", "article", "pub"] as const;
type Group = (typeof GROUPS)[number];
const GROUP_KEY: Record<Group, MsgKey> = { metrics: "grp.metrics", med: "grp.med", prices: "grp.prices", article: "deal.tabArticle", pub: "grp.pub" };
const GROUPS_STORE = "linkbro.workGroups";
const TEMPLATE_KEY = "linkbro.mailTemplate";
const DEFAULT_TEMPLATE = "Hi!\n\nI'm interested in publishing a guest post on {domains}.\nCould you share your current terms and price?\n\nThanks!";

const num = (s: string) => {
  const n = priceFromText(s);
  return n == null ? null : n;
};

export default function Work({
  projectId,
  initialView,
  rows,
  custom,
  members,
  dupes,
  medBusy,
}: {
  projectId: string;
  initialView?: "table" | "kanban";
  rows: ProjectDonor[];
  custom: CustomStatuses;
  members: Member[];
  dupes: Record<string, string[]>;
  medBusy: MedBusy;
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [shown, setShown] = useState<Group[]>(["med", "prices", "pub"]);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [card, setCard] = useState<ProjectDonor | null>(null);

  useEffect(() => {
    try {
      const g = localStorage.getItem(GROUPS_STORE);
      if (g) setShown(JSON.parse(g));
      else if (window.innerWidth < 800) setShown(["med"]);
      const vw = localStorage.getItem("linkbro.workView");
      if (initialView) setView(initialView);
      else if (vw === "kanban" || vw === "table") setView(vw);
      else if (window.innerWidth < 800) setView("kanban");
      const tpl = localStorage.getItem(TEMPLATE_KEY);
      if (tpl) setTemplate(tpl);
    } catch {
      /* без сохранённых настроек */
    }
  }, []);

  function toggle(g: Group) {
    const next = shown.includes(g) ? shown.filter((x) => x !== g) : [...shown, g];
    setShown(next);
    try {
      localStorage.setItem(GROUPS_STORE, JSON.stringify(next));
    } catch {
      /* не страшно */
    }
  }

  const pos = useMemo(() => [...CORE_POS, ...custom.core_pos], [custom]);
  const neg = useMemo(() => [...CORE_NEG, ...custom.core_neg], [custom]);
  const statusOpts = useMemo(
    () => [{ value: "new_core", label: "new_core" }, ...pos.map((s) => ({ value: s, label: `✓ ${s}` })), ...neg.map((s) => ({ value: s, label: `✕ ${s}` }))],
    [pos, neg],
  );
  const memberOpts = useMemo(() => [{ value: "", label: "—" }, ...members.map((m) => ({ value: m.id, label: m.name }))], [members]);
  const indOpts = useMemo(() => [{ value: "", label: "—" }, ...INDICATORS.map((i) => ({ value: i.value, label: t(i.key) }))], [t]);
  const payOpts = useMemo(() => PAY_STATUSES.map((p) => ({ value: p.value, label: p.key ? t(p.key) : "—" })), [t]);
  const gpOpts = useMemo(() => [{ value: "", label: "—" }, ...GP_STATUSES.map((s) => ({ value: s, label: s }))], []);
  const curOpts = useMemo(() => CURRENCIES.map((c) => ({ value: c, label: c })), []);
  const srcOpts = useMemo(() => [{ value: "", label: "—" }, ...SOURCES.map((s) => ({ value: s.name, label: s.name }))], []);
  const artOpts = useMemo(() => ["", "todo", "writing", "review", "ready", "sent"].map((s) => ({ value: s, label: s ? t(`art.${s}` as MsgKey) : "—" })), [t]);
  const idxOpts = useMemo(() => [{ value: "", label: "—" }, { value: "yes", label: t("common.yes") }, { value: "no", label: t("common.no") }], [t]);

  const columns: SheetCol<ProjectDonor>[] = useMemo(() => {
    const cols: SheetCol<ProjectDonor>[] = [
      {
        key: "domain",
        header: "Domain",
        kind: "readonly",
        width: 170,
        render: (d) => (
          <span className="font-mono font-semibold whitespace-nowrap">
            {d.domain}
            <DupeBadge items={dupes[d.domain]} />
          </span>
        ),
      },
      {
        key: "next_action_at",
        header: t("deal.nextAt"),
        kind: "date",
        width: 110,
        render: (d, v) => {
          const val = v("next_action_at");
          if (!val) return <span className="sh-ph">—</span>;
          const late = val <= new Date().toISOString().slice(0, 10);
          return (
            <span className={`whitespace-nowrap font-mono ${late ? "text-bad font-semibold" : ""}`} title={d.next_action} suppressHydrationWarning>
              {val.split("-").reverse().join(".")}
            </span>
          );
        },
      },
      {
        key: "core_status",
        header: t("common.status"),
        kind: "select",
        width: 150,
        options: statusOpts,
        tone: (v) => (pos.includes(v) ? "ok" : neg.includes(v) ? "bad" : ""),
      },
    ];
    if (shown.includes("metrics")) {
      cols.push(
        { key: "added", header: "Date Added", kind: "readonly", width: 90, mono: true, get: (d) => fmtDate(d.added_at, intl) },
        ...metricCols(),
        { key: "category_page", header: "Category Page", kind: "text", width: 130, placeholder: "/blog/" },
      );
    }
    if (shown.includes("med")) {
      cols.push(
        {
          key: "med_base",
          header: t("med.intermediary"),
          kind: "text",
          width: 200,
          placeholder: t("med.contactPh"),
          render: (d, v) => (
            <span className="whitespace-nowrap">
              <span className="inline-block max-w-44 truncate align-middle">{v("med_base") || <span className="sh-ph">{t("med.contactPh")}</span>}</span>
              <DupeBadge
                label={t("comm.medIn")}
                items={(medBusy[d.med_base] ?? []).filter((x) => x.donorId !== d.id && x.assignee !== d.assignee).map((x) => x.label)}
              />
            </span>
          ),
        },
        {
          key: "indicator",
          header: t("field.indicator"),
          kind: "select",
          width: 140,
          options: indOpts,
          get: (d) => d.indicator ?? "",
          render: (d, v) => {
            const val = v("indicator");
            if (!val) return <span className="text-mute">—</span>;
            const label = indOpts.find((o) => o.value === val)?.label ?? val;
            const hrs = val === d.indicator ? hoursSince(d.indicator_at) : null;
            const tone = val === "replied" ? "pill-ok" : val === "waiting" && hrs != null ? (hrs < 24 ? "" : hrs < 72 ? "pill-warn" : "pill-bad") : "";
            return (
              <span className={`pill ${tone}`} suppressHydrationWarning>
                {label}
                {hrs != null && val !== "replied" ? ` (${ageLabel(hrs, t)})` : ""}
              </span>
            );
          },
        },
        {
          key: "dialog",
          header: t("comm.dialog"),
          kind: "text",
          width: 130,
          placeholder: t("comm.dialogPh"),
          render: (_d, v) => {
            const url = v("dialog");
            if (!url) return <span className="sh-ph">{t("comm.dialogPh")}</span>;
            return /^https?:\/\//.test(url) ? (
              <a href={url} target="_blank" rel="noreferrer" className="underline">{t("comm.openLink")}</a>
            ) : (
              <span className="sh-text">{url}</span>
            );
          },
        },
      );
    }
    if (shown.includes("prices")) {
      cols.push(
        { key: "gp_price", header: t("work.medPrice"), kind: "number", width: 90, mono: true },
        { key: "gp_currency", header: t("common.currency"), kind: "select", width: 70, options: curOpts },
        { key: "gp_source", header: t("work.source"), kind: "select", width: 120, options: srcOpts },
        { key: "gp_commission", header: t("gp.commission"), kind: "number", width: 70, mono: true },
        {
          key: "real",
          header: t("gp.real"),
          kind: "readonly",
          width: 90,
          render: (_d, v) => {
            const p = num(v("gp_price"));
            if (p == null) return <span className="text-mute">—</span>;
            const c = Number(v("gp_commission").replace(",", ".")) || 0;
            return <span className="font-mono">{fmtAmount(p * (1 + c / 100), v("gp_currency") || "USD", intl)}</span>;
          },
        },
        { key: "client_price", header: t("work.clientPrice"), kind: "number", width: 90, mono: true },
        {
          key: "margin",
          header: t("work.margin"),
          kind: "readonly",
          width: 90,
          render: (_d, v) => {
            const cp = num(v("client_price"));
            const p = num(v("gp_price"));
            if (cp == null || p == null) return <span className="text-mute">—</span>;
            const c = Number(v("gp_commission").replace(",", ".")) || 0;
            const m = cp - p * (1 + c / 100);
            return <span className={`font-mono ${m < 0 ? "text-bad" : "text-ok"}`}>{fmtAmount(m, v("gp_currency") || "USD", intl)}</span>;
          },
        },
      );
    }
    if (shown.includes("article")) {
      cols.push(
        { key: "article_writer", header: t("deal.writer"), kind: "text", width: 120, placeholder: t("deal.writerPh") },
        { key: "article_doc", header: t("deal.doc"), kind: "text", width: 140, placeholder: "docs.google.com/…" },
        { key: "article_deadline", header: t("deal.deadline"), kind: "date", width: 110 },
        { key: "article_status", header: t("common.status"), kind: "select", width: 120, options: artOpts, tone: (v) => (v === "ready" || v === "sent" ? "ok" : v === "review" ? "warn" : "") },
      );
    }
    if (shown.includes("pub")) {
      cols.push(
        { key: "gp_status", header: "Status (GP)", kind: "select", width: 150, options: gpOpts, tone: (v) => (v === "Paid" ? "ok" : v === "Need to correct" ? "bad" : "") },
        {
          key: "pay_status",
          header: t("field.pay"),
          kind: "select",
          width: 110,
          options: payOpts,
          get: (d) => d.pay_status || (payState(d) === "paid" ? "paid" : ""),
          tone: (v) => (v === "paid" ? "ok" : v === "refund" ? "bad" : v === "due" ? "warn" : ""),
        },
        { key: "payments", header: "Payments", kind: "text", width: 120, placeholder: t("gp.paymentsPh") },
        { key: "article_link", header: "Link to the article", kind: "text", width: 140, placeholder: t("gp.articleLinkPh") },
        { key: "page_url", header: "Page URL", kind: "text", width: 140, placeholder: t("gp.pagePh") },
        { key: "anchors", header: "Keywords (Anchor)", kind: "text", width: 130, placeholder: t("gp.anchorsPh") },
        { key: "pre_anchor", header: "Pre-Anchor text", kind: "text", width: 120 },
        { key: "article_url", header: "Article URL", kind: "text", width: 150, placeholder: t("gp.articlePh") },
        {
          key: "link",
          header: t("gp.link"),
          kind: "readonly",
          width: 140,
          render: (d) => <LinkCheck id={d.id} projectId={projectId} status={d.link_status} note={d.link_note} checkedAt={d.link_checked_at} hasUrl={!!d.article_url} />,
        },
        {
          key: "indexed",
          header: t("gp.indexed"),
          kind: "select",
          width: 80,
          options: idxOpts,
          get: (d) => (d.indexed == null ? "" : d.indexed ? "yes" : "no"),
          tone: (v) => (v === "yes" ? "ok" : v === "no" ? "bad" : ""),
        },
        {
          key: "guarantee_until",
          header: t("gp.guarantee"),
          kind: "date",
          width: 120,
          render: (_d, v) => {
            const val = v("guarantee_until");
            if (!val) return <span className="sh-ph">{t("gp.date")}</span>;
            const left = daysLeft(val);
            return (
              <span className="whitespace-nowrap font-mono" suppressHydrationWarning>
                {val.split("-").reverse().join(".")}
                {left != null && <span className={`pill ml-1 ${left < 0 ? "" : left <= 7 ? "pill-warn" : "pill-ok"}`}>{left < 0 ? t("gp.expired") : t("unit.days", { n: left })}</span>}
              </span>
            );
          },
        },
      );
    }
    cols.push({ key: "assignee", header: t("common.assignee"), kind: "select", width: 130, options: memberOpts });
    return cols;
  }, [shown, t, intl, dupes, medBusy, statusOpts, pos, neg, indOpts, payOpts, gpOpts, curOpts, srcOpts, idxOpts, artOpts, memberOpts, projectId]);

  // Черновики писем: донорам с посредником, кому ещё не писали. Один посредник — одно письмо.
  const groups = useMemo(() => {
    const g = new Map<string, ProjectDonor[]>();
    for (const d of rows) {
      if (!d.med_base || d.indicator) continue;
      g.set(d.med_base, [...(g.get(d.med_base) ?? []), d]);
    }
    return [...g.entries()];
  }, [rows]);

  function find() {
    start(async () => {
      const r = await findIntermediaries(projectId);
      setMsg(r.error ? { text: r.error, bad: true } : { text: t("work.found", { found: r.found, missing: r.missing }) });
      router.refresh();
    });
  }

  function sent() {
    const ids = groups.flatMap(([, list]) => list.map((d) => d.id));
    start(async () => {
      const r = await markContacted(projectId, ids);
      setDraftsOpen(false);
      setMsg(r.ok ? { text: t("comm.marked", { n: ids.length }) } : { text: r.error, bad: true });
      router.refresh();
    });
  }

  function saveTemplate(v: string) {
    setTemplate(v);
    try {
      localStorage.setItem(TEMPLATE_KEY, v);
    } catch {
      /* не страшно */
    }
  }

  const setAll = (ids: string[], field: string, value: string) => updateDonorsBatch(projectId, ids.map((id) => ({ id, field, value })));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-pri" onClick={find} disabled={busy}>{t("work.find")}</button>
        <button type="button" className="btn" onClick={() => setDraftsOpen(true)} disabled={busy}>
          {t("comm.drafts")}{groups.length ? ` (${groups.length})` : ""}
        </button>
        <AddStatus kinds={[{ value: "core_pos", label: t("core.pos") }, { value: "core_neg", label: t("core.neg") }]} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <div className="seg" role="group" aria-label={t("work.view")}>
          {(["kanban", "table"] as const).map((vw) => (
            <button
              key={vw}
              type="button"
              className={view === vw ? "seg-on" : ""}
              aria-pressed={view === vw}
              onClick={() => {
                setView(vw);
                try {
                  localStorage.setItem("linkbro.workView", vw);
                } catch {
                  /* не страшно */
                }
              }}
            >
              {t(vw === "kanban" ? "work.kanban" : "work.table")}
            </button>
          ))}
        </div>
      </div>
      {view === "table" && <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-mute">{t("work.groups")}</span>
        {GROUPS.map((g) => (
          <button key={g} type="button" className={`btn btn-sm ${shown.includes(g) ? "btn-pri" : ""}`} aria-pressed={shown.includes(g)} onClick={() => toggle(g)}>
            {t(GROUP_KEY[g])}
          </button>
        ))}
      </div>}

      {msg && <p className={`note ${msg.bad ? "note-bad" : "note-ok"}`} role="status">{msg.text}</p>}

      {view === "kanban" && <Kanban projectId={projectId} rows={rows} customNeg={custom.core_neg} onOpen={setCard} />}
      {card && <DonorCard projectId={projectId} donor={card} statusOpts={statusOpts} onClose={() => setCard(null)} />}

      {view === "table" && <Sheet
        key={shown.join(",")}
        onOpen={setCard}
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkSelect label={t("common.status")} options={statusOpts} onApply={(v) => setAll(ids, "core_status", v)} />
            <BulkSelect label={t("field.indicator")} options={indOpts} onApply={(v) => setAll(ids, "indicator", v)} />
            <BulkSelect label={t("field.pay")} options={payOpts} onApply={(v) => setAll(ids, "pay_status", v)} />
            <BulkSelect label={t("common.assignee")} options={memberOpts} onApply={(v) => setAll(ids, "assignee", v)} />
          </>
        )}
        empty={<div className="card text-center text-mute">{t("core.empty")}</div>}
      />}

      {draftsOpen && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setDraftsOpen(false)}>
          <div className="card flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-auto" role="dialog" aria-label={t("comm.draftsTitle")}>
            <div>
              <h2 className="font-display text-lg font-semibold">{t("comm.draftsTitle")}</h2>
              <p className="mt-1 text-sm text-mute">{t("comm.draftsHint")}</p>
            </div>
            <div className="field">
              <label htmlFor="tpl" className="lbl">{t("comm.template")}</label>
              <textarea id="tpl" className="inp min-h-28 text-sm" value={template} onChange={(e) => saveTemplate(e.target.value)} />
            </div>
            {groups.length === 0 ? (
              <p className="text-mute">{t("work.noDrafts")}</p>
            ) : (
              groups.map(([to, list]) => {
                const body = template.replaceAll("{domains}", list.map((d) => d.domain).join(", "));
                return (
                  <div key={to} className="rounded-md border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="lbl">{t("comm.to")}</span>
                      <span className="font-mono text-sm">{to}</span>
                      <CopyButton text={to} />
                    </div>
                    <pre className="mb-2 whitespace-pre-wrap rounded bg-bg p-2 text-sm">{body}</pre>
                    <CopyButton text={body} />
                  </div>
                );
              })
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-pri" disabled={busy || groups.length === 0} onClick={sent}>{t("comm.markSent")}</button>
              <button type="button" className="btn" onClick={() => setDraftsOpen(false)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
