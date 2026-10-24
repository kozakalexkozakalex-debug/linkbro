"use client";

// Карточка сделки: вверху статус и следующий шаг, ниже вкладки Переписка · Ціни · Стаття · Публікація.
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import { addOffer, deleteActivity, getDealPanel, logActivity, saveContact, type Channel, type Contact, type DealPanel } from "../deal-actions";
import { CURRENCIES, SOURCES, fmtAmount, priceFromText } from "@/lib/money";
import { type ProjectDonor } from "@/lib/project";
import { fmtDateTime } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";
import type { Opt } from "@/lib/sheet";

const FIELDS = [
  "core_status", "med_base", "next_action_at", "next_action", "dialog", "exchange_url",
  "gp_price", "gp_currency", "gp_source", "gp_commission", "client_price",
  "article_writer", "article_doc", "article_deadline", "article_status",
  "page_url", "anchors", "pre_anchor", "article_url",
] as const;
type F = (typeof FIELDS)[number];
type Tab = "chat" | "prices" | "article" | "pub";
const TABS: { key: Tab; label: MsgKey }[] = [
  { key: "chat", label: "deal.tabChat" },
  { key: "prices", label: "grp.prices" },
  { key: "article", label: "deal.tabArticle" },
  { key: "pub", label: "grp.pub" },
];
const CH_ICON: Record<Channel, string> = { email: "📧", telegram: "✈️", whatsapp: "💬", exchange: "🏪", call: "📞", note: "📝" };
const ART_STATUS = ["", "todo", "writing", "review", "ready", "sent"] as const;
const TEMPLATE_KEY = "linkbro.mailTemplate";
const DEFAULT_TEMPLATE = "Hi!\n\nI'm interested in publishing a guest post on {domains}.\nCould you share your current terms and price?\n\nThanks!";

function digits(s: string) {
  return s.replace(/[^\d]/g, "");
}

export default function DonorCard({ projectId, donor, statusOpts, onClose }: { projectId: string; donor: ProjectDonor; statusOpts: Opt[]; onClose: () => void }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [panel, setPanel] = useState<DealPanel | null>(null);
  const init = Object.fromEntries(FIELDS.map((f) => [f, donor[f] == null ? "" : String(donor[f])])) as Record<F, string>;
  const [d, setD] = useState(init);
  const [contact, setContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState(false);
  const [log, setLog] = useState({ channel: "telegram" as Channel, body: "", price: "", currency: donor.gp_currency || "USD", replied: false });
  const g = donor.global_donors;

  const load = useCallback(() => {
    getDealPanel(donor.id, donor.domain, d.med_base)
      .then((p) => {
        setPanel(p);
        setContact(p.contact);
      })
      .catch(() => setPanel({ activities: [], contact: null, offers: [], sameMed: [] }));
  }, [donor.id, donor.domain, d.med_base]);
  useEffect(() => {
    load();
    // при смене посредника — перечитать его каналы
  }, [donor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (f: F) => (e: { target: { value: string } }) => setD({ ...d, [f]: e.target.value });
  const p = priceFromText(d.gp_price);
  const cp = priceFromText(d.client_price);
  const real = p == null ? null : p * (1 + (Number(d.gp_commission.replace(",", ".")) || 0) / 100);
  const cur = d.gp_currency || "USD";

  function saveFields(close: boolean) {
    const changes = FIELDS.filter((f) => d[f] !== init[f]).map((f) => ({ id: donor.id, field: f, value: d[f] }));
    start(async () => {
      if (changes.length) {
        const r = await updateDonorsBatch(projectId, changes);
        if (!r.ok) return setErr(r.error);
      }
      router.refresh();
      if (close) onClose();
    });
  }

  function message(): string {
    let tpl = DEFAULT_TEMPLATE;
    try {
      tpl = localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
    } catch {
      /* шаблон по умолчанию */
    }
    return tpl.replaceAll("{domains}", donor.domain).replaceAll("{domain}", donor.domain).replaceAll("{anchor}", d.anchors).replaceAll("{page}", d.page_url);
  }

  // Кнопка канала: текст в буфер, открыть чат/почту, записать «написал» в ленту
  function reach(channel: Channel) {
    const text = message();
    const c = contact;
    let url = "";
    if (channel === "email" && c?.email) url = `mailto:${c.email}?subject=${encodeURIComponent(`Guest post: ${donor.domain}`)}&body=${encodeURIComponent(text)}`;
    if (channel === "telegram" && c?.telegram) {
      const tg = c.telegram.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
      url = /^\+?\d+$/.test(tg) ? `https://t.me/+${digits(tg)}` : `https://t.me/${tg}`;
    }
    if (channel === "whatsapp" && c?.whatsapp) url = `https://wa.me/${digits(c.whatsapp)}?text=${encodeURIComponent(text)}`;
    if (channel === "exchange" && d.exchange_url) url = /^https?:\/\//.test(d.exchange_url) ? d.exchange_url : `https://${d.exchange_url}`;
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      /* без буфера */
    }
    if (url && channel === "email") window.location.href = url;
    else if (url) window.open(url, "_blank", "noopener");
    start(async () => {
      const r = await logActivity({ projectId, donorId: donor.id, channel, body: t("deal.sentVia"), sent: true });
      if (!r.ok) setErr(r.error);
      load();
      router.refresh();
    });
  }

  function submitLog() {
    start(async () => {
      const r = await logActivity({
        projectId,
        donorId: donor.id,
        channel: log.channel,
        body: log.body,
        replied: log.replied,
        price: log.price,
        currency: log.currency,
        nextAt: d.next_action_at !== init.next_action_at || d.next_action !== init.next_action ? d.next_action_at : undefined,
        nextText: d.next_action,
      });
      if (!r.ok) return setErr(r.error);
      if (log.price) setD((x) => ({ ...x, gp_price: log.price, gp_currency: log.currency }));
      setLog({ ...log, body: "", price: "", replied: false });
      setErr(null);
      load();
      router.refresh();
    });
  }

  function saveCh() {
    if (!contact) return;
    start(async () => {
      const r = await saveContact({ ...contact, handle: d.med_base.trim() });
      if (!r.ok) return setErr(r.error);
      setEditContact(false);
      load();
    });
  }

  function useOffer(o: { handle: string; price: number; currency: string }) {
    setD({ ...d, med_base: o.handle || d.med_base, gp_price: String(o.price), gp_currency: o.currency });
  }

  function newOffer() {
    if (!d.gp_price) return;
    start(async () => {
      const r = await addOffer(donor.domain, d.med_base, d.gp_price, cur);
      if (!r.ok) setErr(r.error);
      load();
    });
  }

  const row = (label: string, el: React.ReactNode, id?: string) => (
    <div className="grid grid-cols-[minmax(0,38%)_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="lbl">{label}</label>
      <div className="min-w-0">{el}</div>
    </div>
  );
  const inp = (f: F, ph?: string, type?: string, mode?: "decimal") => (
    <input id={`dc-${f}`} className="inp" type={type ?? "text"} value={d[f]} onChange={set(f)} placeholder={ph} inputMode={mode} />
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdue = d.next_action_at && d.next_action_at <= today;

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex w-full max-w-xl flex-col gap-3" role="dialog" aria-label={donor.domain}>
        {/* Шапка: домен, метрики, статус, следующий шаг */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold">{donor.domain}</h2>
            <p className="font-mono text-xs text-mute">
              DR {g?.dr ?? "—"} · Traffic {g?.traffic ?? "—"} · TF/CF {g?.tf ?? "—"}/{g?.cf ?? "—"} · {g?.geo || "—"}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>
        <select aria-label={t("common.status")} className="inp" value={d.core_status} onChange={set("core_status")}>
          {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className={`grid grid-cols-[140px_1fr] gap-2 rounded-md p-2 ${overdue ? "bg-warn-soft" : "bg-bg"}`}>
          <input aria-label={t("deal.nextAt")} className="inp" type="date" value={d.next_action_at} onChange={set("next_action_at")} />
          <input aria-label={t("deal.next")} className="inp" value={d.next_action} onChange={set("next_action")} placeholder={t("deal.nextPh")} />
        </div>

        <div className="seg self-start" role="tablist">
          {TABS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={tab === x.key ? "seg-on" : ""} onClick={() => setTab(x.key)}>
              {t(x.label)}
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <div className="flex flex-col gap-3">
            {row(t("med.intermediary"), inp("med_base", t("med.contactPh")), "dc-med_base")}
            {d.med_base.trim() && contact && (
              <div className="rounded-md border border-line p-2">
                {editContact ? (
                  <div className="flex flex-col gap-2">
                    <select aria-label={t("deal.kind")} className="inp" value={contact.kind} onChange={(e) => setContact({ ...contact, kind: e.target.value })}>
                      <option value="intermediary">{t("deal.kindMed")}</option>
                      <option value="owner">{t("deal.kindOwner")}</option>
                      <option value="exchange">{t("deal.kindExchange")}</option>
                    </select>
                    <input aria-label="Email" className="inp" placeholder="📧 email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                    <input aria-label="Telegram" className="inp" placeholder="✈️ @telegram" value={contact.telegram} onChange={(e) => setContact({ ...contact, telegram: e.target.value })} />
                    <input aria-label="WhatsApp" className="inp" placeholder="💬 WhatsApp +380…" value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} />
                    <input aria-label={t("deal.other")} className="inp" placeholder={t("deal.other")} value={contact.other} onChange={(e) => setContact({ ...contact, other: e.target.value })} />
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-pri btn-sm" onClick={saveCh} disabled={pending}>{t("common.save")}</button>
                      <button type="button" className="btn btn-sm" onClick={() => setEditContact(false)}>{t("common.cancel")}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {contact.email && <button type="button" className="btn btn-sm" onClick={() => reach("email")}>📧 {t("deal.write")}</button>}
                    {contact.telegram && <button type="button" className="btn btn-sm" onClick={() => reach("telegram")}>✈️ Telegram</button>}
                    {contact.whatsapp && <button type="button" className="btn btn-sm" onClick={() => reach("whatsapp")}>💬 WhatsApp</button>}
                    {d.exchange_url && <button type="button" className="btn btn-sm" onClick={() => reach("exchange")}>🏪 {t("deal.exchange")}</button>}
                    <button type="button" className="btn btn-sm" onClick={() => setEditContact(true)}>✎ {t("deal.channels")}</button>
                    <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(d.med_base.trim())}`} className="ml-auto text-xs underline">{t("medp.open")}</Link>
                    {!contact.email && !contact.telegram && !contact.whatsapp && <p className="w-full text-xs text-mute">{t("deal.noChannels")}</p>}
                  </div>
                )}
              </div>
            )}
            {d.med_base !== init.med_base && d.med_base.trim() && (
              <button type="button" className="btn btn-sm self-start" onClick={() => saveFields(false)} disabled={pending}>{t("deal.saveMed")}</button>
            )}

            {/* Быстрая запись в ленту */}
            <div className="flex flex-col gap-2 rounded-md bg-bg p-2">
              <div className="flex flex-wrap gap-1">
                {(["email", "telegram", "whatsapp", "exchange", "call", "note"] as Channel[]).map((c) => (
                  <button key={c} type="button" className={`btn btn-sm ${log.channel === c ? "btn-pri" : ""}`} onClick={() => setLog({ ...log, channel: c })} aria-label={c}>
                    {CH_ICON[c]}
                  </button>
                ))}
              </div>
              <textarea aria-label={t("deal.logPh")} className="inp min-h-16 text-sm" value={log.body} onChange={(e) => setLog({ ...log, body: e.target.value })} placeholder={t("deal.logPh")} />
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <input aria-label={t("work.medPrice")} className="inp" inputMode="decimal" value={log.price} onChange={(e) => setLog({ ...log, price: e.target.value })} placeholder={t("deal.pricePh")} />
                <select aria-label={t("common.currency")} className="inp" value={log.currency} onChange={(e) => setLog({ ...log, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={log.replied} onChange={(e) => setLog({ ...log, replied: e.target.checked })} />
                {t("deal.replied")}
              </label>
              <button type="button" className="btn btn-pri" onClick={submitLog} disabled={pending}>{t("deal.addLog")}</button>
            </div>

            {/* Лента */}
            {panel == null ? (
              <div className="skel h-16" />
            ) : panel.activities.length === 0 ? (
              <p className="text-sm text-mute">{t("deal.noLog")}</p>
            ) : (
              <ul className="flex max-h-60 flex-col gap-1 overflow-auto text-sm">
                {panel.activities.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span aria-hidden="true">{CH_ICON[a.channel]}</span>
                    <span className="shrink-0 font-mono text-xs text-mute">{fmtDateTime(a.created_at, intl)}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{a.body}</span>
                    <button
                      type="button"
                      className="text-xs text-mute"
                      aria-label={t("common.delete")}
                      onClick={() => start(async () => { await deleteActivity(a.id); load(); })}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {panel && panel.sameMed.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-mute">{t("card.sameMed", { n: panel.sameMed.length })}</summary>
                <ul className="mt-1">
                  {panel.sameMed.map((m, i) => <li key={i}><span className="font-mono">{m.domain}</span> <span className="text-mute">{m.project} · {m.status}</span></li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        {tab === "prices" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_90px] gap-2">
              {row(t("work.medPrice"), inp("gp_price", "", "text", "decimal"), "dc-gp_price")}
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
            {row(t("gp.commission"), inp("gp_commission", "0", "text", "decimal"), "dc-gp_commission")}
            {row(t("work.clientPrice"), inp("client_price", "", "text", "decimal"), "dc-client_price")}
            <div className="grid grid-cols-2 gap-2 rounded-md bg-bg p-3 text-sm">
              <span>{t("gp.real")}: <b className="font-mono">{real == null ? "—" : fmtAmount(real, cur, intl)}</b></span>
              <span>{t("work.margin")}:{" "}
                <b className={`font-mono ${cp != null && real != null && cp - real < 0 ? "text-bad" : "text-ok"}`}>{cp == null || real == null ? "—" : fmtAmount(cp - real, cur, intl)}</b>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="lbl">{t("deal.offers")}</p>
              <button type="button" className="btn btn-sm" onClick={newOffer} disabled={pending || !d.gp_price}>{t("deal.saveOffer")}</button>
            </div>
            {panel && panel.offers.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {panel.offers.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{o.handle || "—"}</span>
                    <span className="font-mono">{fmtAmount(Number(o.price), o.currency, intl)}</span>
                    <span className="font-mono text-xs text-mute">{o.created_at.slice(0, 10).split("-").reverse().join(".")}</span>
                    <button type="button" className="btn btn-sm" onClick={() => useOffer({ handle: o.handle, price: Number(o.price), currency: o.currency })}>{t("deal.useOffer")}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">{t("deal.noOffers")}</p>
            )}
          </div>
        )}

        {tab === "article" && (
          <div className="flex flex-col gap-2">
            {row(t("deal.writer"), inp("article_writer", t("deal.writerPh")), "dc-article_writer")}
            {row(t("deal.doc"), inp("article_doc", "docs.google.com/…"), "dc-article_doc")}
            {d.article_doc && (
              <a href={/^https?:\/\//.test(d.article_doc) ? d.article_doc : `https://${d.article_doc}`} target="_blank" rel="noreferrer" className="self-end text-sm underline">{t("comm.openLink")}</a>
            )}
            {row(t("deal.deadline"), inp("article_deadline", "", "date"), "dc-article_deadline")}
            {row(t("common.status"), (
              <select id="dc-article_status" className="inp" value={d.article_status} onChange={set("article_status")}>
                {ART_STATUS.map((s) => <option key={s} value={s}>{s ? t(`art.${s}` as MsgKey) : "—"}</option>)}
              </select>
            ), "dc-article_status")}
          </div>
        )}

        {tab === "pub" && (
          <div className="flex flex-col gap-2">
            {row("Page URL", inp("page_url", t("gp.pagePh")), "dc-page_url")}
            {row("Anchor", inp("anchors", t("gp.anchorsPh")), "dc-anchors")}
            {row("Pre-anchor", inp("pre_anchor"), "dc-pre_anchor")}
            {row(t("deal.exchangeUrl"), inp("exchange_url", "collaborator.pro/…"), "dc-exchange_url")}
            {row("Article URL", inp("article_url", t("gp.articlePh")), "dc-article_url")}
            <p className="text-xs text-mute">{t("card.autoPub")}</p>
          </div>
        )}

        {err && <p className="note note-bad">{err}</p>}
        <div className="sticky bottom-0 flex gap-2 bg-panel pt-2">
          <button type="button" className="btn btn-pri flex-1" onClick={() => saveFields(true)} disabled={pending}>{t("common.save")}</button>
          <button type="button" className="btn" onClick={onClose}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
