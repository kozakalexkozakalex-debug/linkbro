"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWriter, updateWritersBatch } from "./actions";
import Sheet, { type SheetCol } from "@/components/Sheet";
import { CURRENCIES } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";

export type WriterRow = {
  id: string;
  name: string;
  contact: string;
  rate: number | null;
  rate_unit: string;
  currency: string;
  languages: string;
  niches: string;
  notes: string;
  articles: number;
};

export default function WritersTable({ rows }: { rows: WriterRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const unitOpts = useMemo(() => [
    { value: "article", label: t("wr.perArticle") },
    { value: "1000chars", label: t("wr.per1000c") },
    { value: "1000words", label: t("wr.per1000w") },
  ], [t]);
  const curOpts = useMemo(() => CURRENCIES.map((c) => ({ value: c, label: c })), []);
  const columns: SheetCol<WriterRow>[] = useMemo(() => [
    { key: "name", header: t("auth.name"), kind: "text", width: 160 },
    { key: "contact", header: t("wr.contact"), kind: "text", width: 180, placeholder: "@telegram / email" },
    { key: "rate", header: t("wr.rate"), kind: "number", width: 80, mono: true },
    { key: "rate_unit", header: t("wr.unit"), kind: "select", width: 130, options: unitOpts },
    { key: "currency", header: t("common.currency"), kind: "select", width: 70, options: curOpts },
    { key: "languages", header: t("prof.language"), kind: "text", width: 120 },
    { key: "niches", header: t("common.niche"), kind: "text", width: 140 },
    { key: "articles", header: t("wr.articles"), kind: "readonly", width: 70, mono: true, get: (r) => String(r.articles) },
    { key: "notes", header: t("prof.notes"), kind: "text", width: 200 },
  ], [t, unitOpts, curOpts]);

  return (
    <>
      <form
        className="card flex flex-wrap items-end gap-2"
        action={(fd: FormData) =>
          start(async () => {
            const r = await addWriter(fd);
            setErr(r.ok ? null : r.error);
            if (r.ok) router.refresh();
          })
        }
      >
        <div className="field min-w-40 flex-1">
          <label htmlFor="w-name" className="lbl">{t("auth.name")}</label>
          <input id="w-name" name="name" className="inp" required maxLength={120} />
        </div>
        <div className="field min-w-40 flex-1">
          <label htmlFor="w-contact" className="lbl">{t("wr.contact")}</label>
          <input id="w-contact" name="contact" className="inp" placeholder="@telegram / email" />
        </div>
        <div className="field w-24">
          <label htmlFor="w-rate" className="lbl">{t("wr.rate")}</label>
          <input id="w-rate" name="rate" className="inp" inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor="w-unit" className="lbl">{t("wr.unit")}</label>
          <select id="w-unit" name="rate_unit" className="inp">
            {unitOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field w-24">
          <label htmlFor="w-cur" className="lbl">{t("common.currency")}</label>
          <select id="w-cur" name="currency" className="inp">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-pri" disabled={pending}>{t("common.add")}</button>
      </form>
      {err && <p className="note note-bad">{err}</p>}
      <Sheet rows={rows} columns={columns} onSave={(ch) => updateWritersBatch(ch)} empty={<div className="card text-center text-mute">{t("wr.empty")}</div>} />
    </>
  );
}
