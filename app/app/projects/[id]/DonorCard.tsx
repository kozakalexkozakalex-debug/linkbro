"use client";

// Карточка донора: всё по одному сайту в одном окне — посредник, переписка, цены, статья, история.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDonorExtra, updateDonorsBatch, type DonorExtra } from "../actions";
import { CURRENCIES, SOURCES, fmtAmount, priceFromText } from "@/lib/money";
import { INDICATORS, type ProjectDonor } from "@/lib/project";
import { fmtDateTime } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";
import type { Opt } from "@/lib/sheet";

const FIELDS = ["core_status", "med_base", "indicator", "dialog", "gp_price", "gp_currency", "gp_source", "gp_commission", "client_price", "page_url", "anchors", "article_url"] as const;
type F = (typeof FIELDS)[number];

export default function DonorCard({ projectId, donor, statusOpts, onClose }: { projectId: string; donor: ProjectDonor; statusOpts: Opt[]; onClose: () => void }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [extra, setExtra] = useState<DonorExtra | null>(null);
  const init = Object.fromEntries(FIELDS.map((f) => [f, donor[f] == null ? "" : String(donor[f])])) as Record<F, string>;
  const [d, setD] = useState(init);
  const g = donor.global_donors;

  useEffect(() => {
    getDonorExtra(donor.id, donor.med_base).then(setExtra).catch(() => setExtra({ log: [], med: [] }));
  }, [donor.id, donor.med_base]);

  const set = (f: F) => (e: { target: { value: string } }) => setD({ ...d, [f]: e.target.value });
  const p = priceFromText(d.gp_price);
  const cp = priceFromText(d.client_price);
  const real = p == null ? null : p * (1 + (Number(d.gp_commission.replace(",", ".")) || 0) / 100);
  const cur = d.gp_currency || "USD";

  function save() {
    const changes = FIELDS.filter((f) => d[f] !== init[f]).map((f) => ({ id: donor.id, field: f, value: d[f] }));
    if (!changes.length) return onClose();
    start(async () => {
      const r = await updateDonorsBatch(projectId, changes);
      if (!r.ok) return setErr(r.error);
      router.refresh();
      onClose();
    });
  }

  const row = (label: string, el: React.ReactNode, id?: string) => (
    <div className="grid grid-cols-[minmax(0,38%)_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="lbl">{label}</label>
      <div className="min-w-0">{el}</div>
    </div>
  );
  const inp = (f: F, ph?: string, mode?: "decimal") => (
    <input id={`dc-${f}`} className="inp" value={d[f]} onChange={set(f)} placeholder={ph} inputMode={mode} />
  );

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex w-full max-w-xl flex-col gap-4" role="dialog" aria-label={donor.domain}>
        <div>
          <h2 className="font-display text-lg font-medium">{donor.domain}</h2>
          <p className="mt-1 font-mono text-xs text-mute">
            DR {g?.dr ?? "—"} · Traffic {g?.traffic ?? "—"} · TF/CF {g?.tf ?? "—"}/{g?.cf ?? "—"} · {g?.geo || "—"} · {g?.topics || "—"}
          </p>
        </div>

        {row(t("common.status"), (
          <select id="dc-core_status" className="inp" value={d.core_status} onChange={set("core_status")}>
            {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ), "dc-core_status")}

        <p className="lbl -mb-2">{t("grp.med")}</p>
        {row(t("med.intermediary"), inp("med_base", t("med.contactPh")), "dc-med_base")}
        {d.med_base && (
          <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(d.med_base)}`} className="-mt-2 self-end text-sm underline">{t("medp.open")}</Link>
        )}
        {row(t("field.indicator"), (
          <select id="dc-indicator" className="inp" value={d.indicator} onChange={set("indicator")}>
            <option value="">—</option>
            {INDICATORS.map((i) => <option key={i.value} value={i.value}>{t(i.key)}</option>)}
          </select>
        ), "dc-indicator")}
        {row(t("comm.dialog"), inp("dialog", t("comm.dialogPh")), "dc-dialog")}

        <p className="lbl -mb-2">{t("grp.prices")}</p>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          {row(t("work.medPrice"), inp("gp_price", "", "decimal"), "dc-gp_price")}
          <select aria-label={t("common.currency")} className="inp" value={cur} onChange={set("gp_currency")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {row(t("work.source"), (
          <select id="dc-gp_source" className="inp" value={d.gp_source} onChange={set("gp_source")}>
            <option value="">—</option>
            {SOURCES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        ), "dc-gp_source")}
        {row(t("gp.commission"), inp("gp_commission", "0", "decimal"), "dc-gp_commission")}
        {row(t("work.clientPrice"), inp("client_price", "", "decimal"), "dc-client_price")}
        <div className="grid grid-cols-2 gap-2 rounded-md bg-bg p-3 text-sm">
          <span>{t("gp.real")}: <b className="font-mono">{real == null ? "—" : fmtAmount(real, cur, intl)}</b></span>
          <span>{t("work.margin")}:{" "}
            <b className={`font-mono ${cp != null && real != null && cp - real < 0 ? "text-bad" : "text-ok"}`}>
              {cp == null || real == null ? "—" : fmtAmount(cp - real, cur, intl)}
            </b>
          </span>
        </div>

        <p className="lbl -mb-2">{t("grp.pub")}</p>
        {row("Page URL", inp("page_url", t("gp.pagePh")), "dc-page_url")}
        {row("Anchor", inp("anchors", t("gp.anchorsPh")), "dc-anchors")}
        {row("Article URL", inp("article_url", t("gp.articlePh")), "dc-article_url")}
        <p className="-mt-2 text-xs text-mute">{t("card.autoPub")}</p>

        {extra && extra.med.length > 0 && (
          <div>
            <p className="lbl mb-1">{t("card.sameMed", { n: extra.med.length })}</p>
            <ul className="max-h-32 overflow-auto text-sm">
              {extra.med.map((m, i) => (
                <li key={i} className="flex gap-2 py-0.5">
                  <span className="font-mono">{m.domain}</span>
                  <span className="text-mute">{m.project} · {m.status}</span>
                  {m.price != null && <span className="ml-auto font-mono">{fmtAmount(m.price, m.currency || "USD", intl)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {extra && extra.log.length > 0 && (
          <div>
            <p className="lbl mb-1">{t("proj.tabHistory")}</p>
            <ul className="max-h-32 overflow-auto text-xs text-mute">
              {extra.log.map((l, i) => (
                <li key={i} className="py-0.5">
                  <span className="font-mono">{fmtDateTime(l.created_at, intl)}</span> · {l.field}: {l.old_value || "—"} → <b className="text-ink">{l.new_value || "—"}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        {err && <p className="note note-bad">{err}</p>}
        <div className="sticky bottom-0 flex gap-2 bg-panel pt-2">
          <button type="button" className="btn btn-pri flex-1" onClick={save} disabled={pending}>{t("common.save")}</button>
          <button type="button" className="btn" onClick={onClose}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
