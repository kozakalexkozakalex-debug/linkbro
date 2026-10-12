"use client";

import { useMemo } from "react";
import { updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { BulkSelect } from "@/components/BulkTools";
import LinkCheck from "@/components/LinkCheck";
import DupeBadge from "@/components/DupeBadge";
import { GP_STATUSES, type ProjectDonor } from "@/lib/project";
import { CURRENCIES, PAY_STATUSES, SOURCES, daysLeft, fmtAmount, payState, priceFromText } from "@/lib/money";

const CUR_OPTS = CURRENCIES.map((c) => ({ value: c, label: c }));
const PAY_OPTS = PAY_STATUSES.map((p) => ({ value: p.value, label: p.label }));
const GP_OPTS = [{ value: "", label: "—" }, ...GP_STATUSES.map((s) => ({ value: s, label: s }))];
const INDEX_OPTS = [
  { value: "", label: "—" },
  { value: "yes", label: "так" },
  { value: "no", label: "ні" },
];
const SOURCE_OPTS = [{ value: "", label: "—" }, ...SOURCES.map((s) => ({ value: s.name, label: s.name }))];

export default function GuestPosting({
  projectId,
  rows,
  dupes,
}: {
  projectId: string;
  rows: ProjectDonor[];
  dupes: Record<string, string[]>;
}) {
  const columns: SheetCol<ProjectDonor>[] = useMemo(
    () => [
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
      { key: "gp_med", header: "Посередник", kind: "text", width: 170, placeholder: "email посередника" },
      { key: "gp_source", header: "Джерело", kind: "text", width: 110, placeholder: "біржа / напряму" },
      { key: "gp_price", header: "Price", kind: "number", width: 70, mono: true },
      { key: "gp_currency", header: "Валюта", kind: "select", width: 70, options: CUR_OPTS },
      { key: "gp_commission", header: "Комісія %", kind: "number", width: 70, mono: true },
      {
        key: "real",
        header: "Реальна ціна",
        kind: "readonly",
        width: 90,
        render: (_d, v) => {
          const p = priceFromText(v("gp_price"));
          if (p == null) return <span className="text-mute">—</span>;
          const c = Number(v("gp_commission").replace(",", ".")) || 0;
          return <span className="font-mono">{fmtAmount(p * (1 + c / 100), v("gp_currency") || "USD")}</span>;
        },
      },
      {
        key: "pay_status",
        header: "Оплата",
        kind: "select",
        width: 110,
        options: PAY_OPTS,
        get: (d) => d.pay_status || (payState(d) === "paid" ? "paid" : ""),
        tone: (v) => (v === "paid" ? "ok" : v === "refund" ? "bad" : v === "due" ? "warn" : ""),
      },
      { key: "payments", header: "Payments", kind: "text", width: 130, placeholder: "лінк на оплату" },
      { key: "article_link", header: "Link to the article", kind: "text", width: 150, placeholder: "документ або посилання" },
      { key: "page_url", header: "Page URL", kind: "text", width: 150, placeholder: "сторінка клієнта" },
      { key: "anchors", header: "Keywords (Anchor)", kind: "text", width: 140, placeholder: "через кому" },
      { key: "pre_anchor", header: "Pre-Anchor text", kind: "text", width: 130 },
      { key: "article_url", header: "Article URL", kind: "text", width: 160, placeholder: "розміщена стаття" },
      {
        key: "gp_status",
        header: "Status (GP)",
        kind: "select",
        width: 150,
        options: GP_OPTS,
        tone: (v) => (v === "Paid" ? "ok" : v === "Need to correct" ? "bad" : ""),
      },
      {
        key: "link",
        header: "Посилання",
        kind: "readonly",
        width: 150,
        render: (d) => (
          <LinkCheck id={d.id} projectId={projectId} status={d.link_status} note={d.link_note} checkedAt={d.link_checked_at} hasUrl={!!d.article_url} />
        ),
      },
      {
        key: "indexed",
        header: "Індексація",
        kind: "select",
        width: 80,
        options: INDEX_OPTS,
        get: (d) => (d.indexed == null ? "" : d.indexed ? "yes" : "no"),
        tone: (v) => (v === "yes" ? "ok" : v === "no" ? "bad" : ""),
      },
      {
        key: "guarantee_until",
        header: "Гарантія до",
        kind: "date",
        width: 130,
        render: (_d, v) => {
          const val = v("guarantee_until");
          if (!val) return <span className="sh-ph">дата</span>;
          const left = daysLeft(val);
          return (
            <span className="whitespace-nowrap font-mono" suppressHydrationWarning>
              {val.split("-").reverse().join(".")}
              {left != null && (
                <span className={`pill ml-1 ${left < 0 ? "" : left <= 7 ? "pill-warn" : "pill-ok"}`}>{left < 0 ? "минула" : `${left} дн`}</span>
              )}
            </span>
          );
        },
      },
    ],
    [dupes, projectId],
  );

  const setAll = (ids: string[], field: string, value: string) =>
    updateDonorsBatch(projectId, ids.map((id) => ({ id, field, value })));

  return (
    <>
      <p className="text-sm text-mute">
        Посередник і ціна переносяться з Communication. Реальна ціна = ціна + комісія біржі. Посилання з Article URL перевіряються щодня,
        кнопка ↻ — одразу. Джерело Collaborator підставляє комісію 10% і гарантію 90 днів.
      </p>
      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkSelect label="Оплата" options={PAY_OPTS} onApply={(v) => setAll(ids, "pay_status", v)} />
            <BulkSelect label="Status (GP)" options={GP_OPTS} onApply={(v) => setAll(ids, "gp_status", v)} />
            <BulkSelect label="Валюта" options={CUR_OPTS} onApply={(v) => setAll(ids, "gp_currency", v)} />
            <BulkSelect label="Джерело" options={SOURCE_OPTS} onApply={(v) => setAll(ids, "gp_source", v)} />
          </>
        )}
        empty={
          <div className="card text-center text-mute">Відкривається після статусу Accepted у Communication або Price_ok у Project Core.</div>
        }
      />
    </>
  );
}
