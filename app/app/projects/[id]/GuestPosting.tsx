"use client";

import { useMemo } from "react";
import { updateDonorsBatch } from "../actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { BulkSelect } from "@/components/BulkTools";
import LinkCheck from "@/components/LinkCheck";
import DupeBadge from "@/components/DupeBadge";
import { GP_STATUSES, type ProjectDonor } from "@/lib/project";
import { CURRENCIES, PAY_STATUSES, SOURCES, daysLeft, fmtAmount, payState, priceFromText } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";

const CUR_OPTS = CURRENCIES.map((c) => ({ value: c, label: c }));
const GP_OPTS = [{ value: "", label: "—" }, ...GP_STATUSES.map((s) => ({ value: s, label: s }))];
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
  const { t, intl } = useI18n();
  const PAY_OPTS = useMemo(() => PAY_STATUSES.map((p) => ({ value: p.value, label: p.key ? t(p.key) : "—" })), [t]);
  const INDEX_OPTS = useMemo(
    () => [
      { value: "", label: "—" },
      { value: "yes", label: t("common.yes") },
      { value: "no", label: t("common.no") },
    ],
    [t],
  );
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
      { key: "gp_med", header: t("med.intermediary"), kind: "text", width: 170, placeholder: t("gp.medPh") },
      { key: "gp_source", header: t("gp.source"), kind: "text", width: 110, placeholder: t("gp.sourcePh") },
      { key: "gp_price", header: "Price", kind: "number", width: 70, mono: true },
      { key: "gp_currency", header: t("common.currency"), kind: "select", width: 70, options: CUR_OPTS },
      { key: "gp_commission", header: t("gp.commission"), kind: "number", width: 70, mono: true },
      {
        key: "real",
        header: t("gp.real"),
        kind: "readonly",
        width: 90,
        render: (_d, v) => {
          const p = priceFromText(v("gp_price"));
          if (p == null) return <span className="text-mute">—</span>;
          const c = Number(v("gp_commission").replace(",", ".")) || 0;
          return <span className="font-mono">{fmtAmount(p * (1 + c / 100), v("gp_currency") || "USD", intl)}</span>;
        },
      },
      {
        key: "pay_status",
        header: t("field.pay"),
        kind: "select",
        width: 110,
        options: PAY_OPTS,
        get: (d) => d.pay_status || (payState(d) === "paid" ? "paid" : ""),
        tone: (v) => (v === "paid" ? "ok" : v === "refund" ? "bad" : v === "due" ? "warn" : ""),
      },
      { key: "payments", header: "Payments", kind: "text", width: 130, placeholder: t("gp.paymentsPh") },
      { key: "article_link", header: "Link to the article", kind: "text", width: 150, placeholder: t("gp.articleLinkPh") },
      { key: "page_url", header: "Page URL", kind: "text", width: 150, placeholder: t("gp.pagePh") },
      { key: "anchors", header: "Keywords (Anchor)", kind: "text", width: 140, placeholder: t("gp.anchorsPh") },
      { key: "pre_anchor", header: "Pre-Anchor text", kind: "text", width: 130 },
      { key: "article_url", header: "Article URL", kind: "text", width: 160, placeholder: t("gp.articlePh") },
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
        header: t("gp.link"),
        kind: "readonly",
        width: 150,
        render: (d) => (
          <LinkCheck id={d.id} projectId={projectId} status={d.link_status} note={d.link_note} checkedAt={d.link_checked_at} hasUrl={!!d.article_url} />
        ),
      },
      {
        key: "indexed",
        header: t("gp.indexed"),
        kind: "select",
        width: 80,
        options: INDEX_OPTS,
        get: (d) => (d.indexed == null ? "" : d.indexed ? "yes" : "no"),
        tone: (v) => (v === "yes" ? "ok" : v === "no" ? "bad" : ""),
      },
      {
        key: "guarantee_until",
        header: t("gp.guarantee"),
        kind: "date",
        width: 130,
        render: (_d, v) => {
          const val = v("guarantee_until");
          if (!val) return <span className="sh-ph">{t("gp.date")}</span>;
          const left = daysLeft(val);
          return (
            <span className="whitespace-nowrap font-mono" suppressHydrationWarning>
              {val.split("-").reverse().join(".")}
              {left != null && (
                <span className={`pill ml-1 ${left < 0 ? "" : left <= 7 ? "pill-warn" : "pill-ok"}`}>{left < 0 ? t("gp.expired") : t("unit.days", { n: left })}</span>
              )}
            </span>
          );
        },
      },
    ],
    [dupes, projectId, t, intl, PAY_OPTS, INDEX_OPTS],
  );

  const setAll = (ids: string[], field: string, value: string) =>
    updateDonorsBatch(projectId, ids.map((id) => ({ id, field, value })));

  return (
    <>
      <p className="text-sm text-mute">
        {t("gp.lead")}
      </p>
      <Sheet
        rows={rows}
        columns={columns}
        onSave={(changes) => updateDonorsBatch(projectId, changes)}
        bulk={(ids) => (
          <>
            <BulkSelect label={t("field.pay")} options={PAY_OPTS} onApply={(v) => setAll(ids, "pay_status", v)} />
            <BulkSelect label="Status (GP)" options={GP_OPTS} onApply={(v) => setAll(ids, "gp_status", v)} />
            <BulkSelect label={t("common.currency")} options={CUR_OPTS} onApply={(v) => setAll(ids, "gp_currency", v)} />
            <BulkSelect label={t("gp.source")} options={SOURCE_OPTS} onApply={(v) => setAll(ids, "gp_source", v)} />
          </>
        )}
        empty={
          <div className="card text-center text-mute">{t("gp.empty")}</div>
        }
      />
    </>
  );
}
