"use client";

// Карточка сделки: вверху статус и следующий шаг, ниже вкладки Переписка · Ціни · Стаття · Публікація.
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateDonorsBatch } from "../actions";
import { addOffer, priceAction, type OfferKind, addPayment, deleteActivity, getDealPanel, logActivity, saveContact, setPaymentStatus, type Channel, type Contact, type DealPanel } from "../deal-actions";
import { CURRENCIES, SOURCES, fmtAmount, priceFromText } from "@/lib/money";
import { type ProjectDonor } from "@/lib/project";
import { fmtDateTime } from "@/lib/global";
import { useI18n } from "@/components/I18nProvider";
import { markRead, sendDealEmail, syncMyMail } from "../../mail/actions";
import type { MsgKey } from "@/lib/i18n/config";
import type { Opt } from "@/lib/sheet";
import StepPath from "@/components/StepPath";
import { DEAL_STEP_KEY, dealNext, dealPath } from "@/lib/deal";

const FIELDS = [
  "stage", "med_base", "next_action_at", "next_action", "dialog", "exchange_url",
  "gp_price", "gp_currency", "gp_source", "gp_commission", "client_price",
  "article_writer", "writer_id", "article_cost", "brief", "article_doc", "article_deadline", "article_status",
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
  const [msgTpl, setMsgTpl] = useState("");
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [briefTpl, setBriefTpl] = useState("");
  const [log, setLog] = useState({ channel: "telegram" as Channel, body: "", price: "", currency: donor.gp_currency || "USD", replied: false });
  const g = donor.global_donors;

  const load = useCallback(() => {
    getDealPanel(donor.id, donor.domain, d.med_base)
      .then((p) => {
        setPanel(p);
        setContact(p.contact);
      })
      .catch(() => setPanel({ mail: null, templates: [], writers: [], payments: [], activities: [], contact: null, offers: [], sameMed: [], budget: { limit: null, currency: "USD" } }));
  }, [donor.id, donor.domain, d.med_base]);
  useEffect(() => {
    load();
    // Свежая почта и отметка «прочитано» при открытии карточки
    syncMyMail()
      .then((r) => {
        if (r.added) load();
      })
      .catch(() => undefined);
    markRead(donor.id).catch(() => undefined);
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

  // Подстановка переменных в любой шаблон
  function fill(tpl: string): string {
    return tpl
      .replaceAll("{domains}", donor.domain)
      .replaceAll("{domain}", donor.domain)
      .replaceAll("{anchor}", d.anchors)
      .replaceAll("{page}", d.page_url)
      .replaceAll("{price}", d.gp_price ? `${d.gp_price} ${cur}` : "")
      .replaceAll("{deadline}", d.article_deadline ? d.article_deadline.split("-").reverse().join(".") : "");
  }
  function message(): string {
    const chosen = panel?.templates.find((x) => x.id === msgTpl && x.kind === "message");
    if (chosen) return fill(chosen.body);
    let tpl = DEFAULT_TEMPLATE;
    try {
      tpl = localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
    } catch {
      /* шаблон по умолчанию */
    }
    return fill(tpl);
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

  const BRIEF_KEY = "linkbro.briefTemplate";
  const DEFAULT_BRIEF = "Сайт: {domain}\nТема: \nОбсяг: 3000–4000 знаків\nАнкор: {anchor}\nПосилання на: {page}\nВимоги площадки: \nДедлайн: {deadline}";
  function fillBrief() {
    const chosen = panel?.templates.find((x) => x.id === briefTpl && x.kind === "brief");
    if (chosen) return setD({ ...d, brief: fill(chosen.body) });
    let tpl = DEFAULT_BRIEF;
    try {
      tpl = localStorage.getItem(BRIEF_KEY) || DEFAULT_BRIEF;
    } catch {
      /* шаблон по умолчанию */
    }
    const text = tpl
      .replaceAll("{domain}", donor.domain)
      .replaceAll("{anchor}", d.anchors)
      .replaceAll("{page}", d.page_url)
      .replaceAll("{deadline}", d.article_deadline ? d.article_deadline.split("-").reverse().join(".") : "");
    setD({ ...d, brief: text });
  }
  function saveBriefTemplate() {
    try {
      localStorage.setItem(BRIEF_KEY, d.brief.replaceAll(donor.domain, "{domain}"));
    } catch {
      /* не страшно */
    }
  }
  function payWriter() {
    const w = panel?.writers.find((x) => x.id === d.writer_id);
    start(async () => {
      const r = await addPayment({
        projectId,
        donorId: donor.id,
        payeeKind: "writer",
        payee: w?.name || d.article_writer,
        amount: d.article_cost,
        currency: w?.currency || cur,
        note: donor.domain,
      });
      if (!r.ok) return setErr(r.error);
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
  const live = {
    stage: d.stage,
    core_status: donor.core_status,
    indicator: donor.indicator,
    med_base: d.med_base,
    gp_price: d.gp_price,
    pay_status: donor.pay_status,
    article_status: d.article_status,
    article_url: d.article_url,
    link_status: donor.link_status,
  };
  const path = dealPath(live);
  const next = dealNext(live);
  function goNext() {
    if (!next) return;
    setTab(next.tab);
    // «Написати посереднику» — сразу открыть письмо, если email известен
    if (next.step === "written" && contact?.email && panel?.mail) setCompose({ to: contact.email, subject: `Guest post: ${donor.domain}`, body: message() });
    if (next.step === "contact") setTimeout(() => document.getElementById("dc-med_base")?.focus(), 50);
  }

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
        {/* Путь сделки и «що далі» */}
        <StepPath steps={path.steps.map((x) => ({ label: t(DEAL_STEP_KEY[x.key]), mark: x.mark }))} />
        {next && (
          <button type="button" className={`btn ${path.lost ? "" : "btn-pri"} justify-start text-left`} onClick={goNext}>
            {t("dp.next")}: {t(next.key)}
          </button>
        )}
        <select aria-label={t("common.status")} className="inp" value={d.stage} onChange={set("stage")} title={t("dp.manualStage")}>
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
                    {panel && panel.templates.some((x) => x.kind === "message") && (
                      <select aria-label={t("tpl.choose")} className="inp mb-1 w-full" value={msgTpl} onChange={(e) => setMsgTpl(e.target.value)}>
                        <option value="">{t("tpl.default")}</option>
                        {panel.templates.filter((x) => x.kind === "message").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    )}
                    {contact.email && panel?.mail && (
                      <button type="button" className="btn btn-pri btn-sm" onClick={() => setCompose({ to: contact.email, subject: `Guest post: ${donor.domain}`, body: message() })}>
                        📧 {t("mail.compose")}
                      </button>
                    )}
                    {contact.email && !panel?.mail && <button type="button" className="btn btn-sm" onClick={() => reach("email")}>📧 {t("deal.write")}</button>}
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

            {compose && (
              <div className="flex flex-col gap-2 rounded-xl border border-accent p-3">
                <p className="lbl">{t("mail.from", { email: panel?.mail ?? "" })}</p>
                <input aria-label={t("mail.to")} className="inp" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
                <input aria-label={t("mail.subject")} className="inp" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
                <textarea aria-label={t("mail.body")} className="inp min-h-40 text-sm" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-pri flex-1"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await sendDealEmail({ projectId, donorId: donor.id, ...compose });
                        if (!r.ok) return setErr(r.error);
                        setCompose(null);
                        setErr(null);
                        load();
                        router.refresh();
                      })
                    }
                  >
                    {pending ? t("mail.sending") : t("mail.send")}
                  </button>
                  <button type="button" className="btn" onClick={() => setCompose(null)}>{t("common.cancel")}</button>
                </div>
              </div>
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
                  <li key={a.id} className={`flex gap-2 rounded-md p-1 ${a.direction === "in" ? "bg-elev" : ""}`}>
                    <span aria-hidden="true">{CH_ICON[a.channel]}{a.direction === "in" ? "↘" : ""}</span>
                    <span className="shrink-0 font-mono text-xs text-mute">{fmtDateTime(a.created_at, intl)}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                      {(a.donor_ids?.length ?? 0) > 1 && <span className="pill mb-0.5 text-[11px]">{t("gm.shared", { n: a.donor_ids!.length })}</span>}
                      {a.subject && <b className="block">{a.subject}</b>}
                      {a.body}
                    </span>
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
            {panel && (
              <PriceBlock
                projectId={projectId}
                donorId={donor.id}
                offers={panel.offers.filter((o) => o.donor_id === donor.id)}
                budget={panel.budget}
                currency={cur}
                current={priceFromText(d.gp_price)}
                extra={donor.extra_cost}
                onDone={(price) => {
                  if (price != null) setD((x) => ({ ...x, gp_price: String(price) }));
                  load();
                  router.refresh();
                }}
              />
            )}
            <p className="lbl mt-2">{t("pr.details")}</p>
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
              <p className="lbl">{t("pr.otherOffers")}</p>
              <button type="button" className="btn btn-sm" onClick={newOffer} disabled={pending || !d.gp_price}>{t("deal.saveOffer")}</button>
            </div>
            {panel && panel.offers.some((o) => o.donor_id !== donor.id) ? (
              <ul className="divide-y divide-line text-sm">
                {panel.offers.filter((o) => o.donor_id !== donor.id).map((o) => (
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
            {row(t("deal.writer"), (
              panel && panel.writers.length > 0 ? (
                <select
                  id="dc-writer"
                  className="inp"
                  value={d.writer_id}
                  onChange={(e) => {
                    const w = panel.writers.find((x) => x.id === e.target.value);
                    setD({ ...d, writer_id: e.target.value, article_writer: w?.name ?? d.article_writer, article_cost: d.article_cost || (w?.rate != null && w.rate_unit === "article" ? String(w.rate) : d.article_cost) });
                  }}
                >
                  <option value="">{d.article_writer || "—"}</option>
                  {panel.writers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}{w.rate != null ? ` · ${w.rate} ${w.currency}` : ""}</option>
                  ))}
                </select>
              ) : (
                inp("article_writer", t("deal.writerPh"))
              )
            ), "dc-writer")}
            {panel && panel.writers.length === 0 && <Link href="/app/writers" className="self-end text-xs underline">{t("wr.addFirst")}</Link>}
            {row(t("wr.cost"), inp("article_cost", "", "text", "decimal"), "dc-article_cost")}
            {row(t("deal.doc"), inp("article_doc", "docs.google.com/…"), "dc-article_doc")}
            {d.article_doc && (
              <a href={/^https?:\/\//.test(d.article_doc) ? d.article_doc : `https://${d.article_doc}`} target="_blank" rel="noreferrer" className="self-end text-sm underline">{t("comm.openLink")}</a>
            )}
            {row(t("deal.deadline"), inp("article_deadline", "", "date"), "dc-article_deadline")}
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="dc-brief" className="lbl">{t("wr.brief")}</label>
              <div className="flex flex-wrap justify-end gap-1">
                {panel && panel.templates.some((x) => x.kind === "brief") && (
                  <select aria-label={t("tpl.choose")} className="inp h-8 min-h-0 w-auto py-0 text-sm" value={briefTpl} onChange={(e) => setBriefTpl(e.target.value)}>
                    <option value="">{t("tpl.default")}</option>
                    {panel.templates.filter((x) => x.kind === "brief").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                )}
                <button type="button" className="btn btn-sm" onClick={fillBrief}>{t("wr.fillBrief")}</button>
                {d.brief && <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(d.brief)}>{t("common.copy")}</button>}
              </div>
            </div>
            <textarea id="dc-brief" className="inp min-h-32 text-sm" value={d.brief} onChange={set("brief")} onBlur={() => d.brief && saveBriefTemplate()} />
            {row(t("common.status"), (
              <select id="dc-article_status" className="inp" value={d.article_status} onChange={set("article_status")}>
                {ART_STATUS.map((s) => <option key={s} value={s}>{s ? t(`art.${s}` as MsgKey) : "—"}</option>)}
              </select>
            ), "dc-article_status")}
            <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
              <p className="lbl">{t("pay.title")}</p>
              <button type="button" className="btn btn-sm" onClick={payWriter} disabled={pending || !d.article_cost || !(d.writer_id || d.article_writer)}>
                {t("wr.payWriter")}
              </button>
            </div>
            {panel && panel.payments.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {panel.payments.map((pm) => (
                  <li key={pm.id} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{pm.payee || "—"}</span>
                    <span className="font-mono">{fmtAmount(Number(pm.amount), pm.currency, intl)}</span>
                    <button
                      type="button"
                      className={`pill ${pm.status === "paid" ? "pill-ok" : "pill-bad"}`}
                      onClick={() => start(async () => { await setPaymentStatus(pm.id, pm.status !== "paid"); load(); })}
                    >
                      {pm.status === "paid" ? t("pay.paid") : t("pay.due")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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

// ---------- Ціна і бюджет: ліміт проєкту, відхилення, історія пропозицій, рішення ----------
const KIND_KEY: Record<OfferKind, MsgKey> = { quote: "pr.kQuote", counter: "pr.kCounter", agreed: "pr.kAgreed", extra: "pr.kExtra" };

function PriceBlock({
  projectId,
  donorId,
  offers,
  budget,
  currency,
  current,
  extra,
  onDone,
}: {
  projectId: string;
  donorId: string;
  offers: { id: string; price: number; currency: string; kind: OfferKind; note: string; created_at: string }[];
  budget: { limit: number | null; currency: string };
  currency: string;
  current: number | null;
  extra: number;
  onDone: (price: number | null) => void;
}) {
  const { t, intl } = useI18n();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState(currency);
  const [err, setErr] = useState<string | null>(null);
  const agreed = offers.find((o) => o.kind === "agreed");
  const lastAsk = offers.find((o) => o.kind === "quote");
  const lastOur = offers.find((o) => o.kind === "counter");
  const lastAny = offers.find((o) => o.kind === "quote" || o.kind === "counter"); // что примем по «Прийняти»
  const shown = agreed?.price ?? lastAsk?.price ?? current;
  const limit = budget.limit != null && budget.currency === (agreed?.currency ?? lastAsk?.currency ?? currency) ? Number(budget.limit) : null;
  const over = limit && shown != null ? Math.round(((Number(shown) - limit) / limit) * 100) : null;
  const fa = (n: number, c = currency) => fmtAmount(Number(n), c, intl);

  const run = (action: OfferKind | "accept" | "defer" | "decline", withAmount = true) =>
    start(async () => {
      setErr(null);
      const r = await priceAction({ projectId, donorId, action, amount: withAmount ? amount : undefined, currency: cur });
      if (!r.ok) return setErr(r.error);
      const n = Number(amount.replace(/\s/g, "").replace(",", "."));
      setAmount("");
      onDone((action === "quote" || action === "agreed" || action === "accept") && amount.trim() && Number.isFinite(n) ? n : null);
    });

  return (
    <section className="flex flex-col gap-2 rounded-md bg-bg p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="lbl">{t("pr.title")}</p>
        <span className="text-xs text-mute">
          {limit != null ? t("pr.limit", { x: fa(limit, budget.currency) }) : t("pr.noLimit")}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-2xl font-bold tabular-nums">{shown == null ? "—" : fa(shown)}</span>
        <span className="text-sm text-mute">{agreed ? t("pr.isAgreed") : lastAsk ? t("pr.isAsk") : ""}</span>
        {over != null && (
          <span className={`pill ${over > 0 ? "pill-warn" : "pill-ok"}`}>{over > 0 ? `+${over}% ${t("pr.overLimit")}` : `${over}% · ${t("pr.inLimit")}`}</span>
        )}
        {extra > 0 && <span className="text-xs text-mute">+ {t("pr.kExtra").toLowerCase()} {fa(extra)}</span>}
      </div>
      {limit != null && shown != null && (
        <div className="relative h-2 overflow-hidden rounded bg-inset" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (Number(shown) / Math.max(limit, Number(shown))) * 100)}%`, background: over != null && over > 0 ? "var(--warn)" : "var(--ok)" }} />
          <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${Math.min(100, (limit / Math.max(limit, Number(shown))) * 100)}%` }} />
        </div>
      )}

      {offers.length > 0 && (
        <ul className="flex flex-col text-sm">
          {offers.map((o) => (
            <li key={o.id} className="grid grid-cols-[52px_1fr_auto] gap-2 border-b border-dashed border-line py-1 last:border-0">
              <span className="font-mono text-xs text-mute">{o.created_at.slice(5, 10).split("-").reverse().join(".")}</span>
              <span className={o.kind === "agreed" ? "text-ok" : o.kind === "counter" ? "text-accent" : ""}>{t(KIND_KEY[o.kind])}{o.note ? ` · ${o.note}` : ""}</span>
              <b className="font-mono">{fa(o.price, o.currency)}</b>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_84px] gap-2">
        <input aria-label={t("pr.amount")} className="inp" inputMode="decimal" placeholder={t("pr.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select aria-label={t("common.currency")} className="inp" value={cur} onChange={(e) => setCur(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["quote", "counter", "agreed", "extra"] as OfferKind[]).map((k) => (
          <button key={k} type="button" className="btn btn-sm" disabled={pending || !amount.trim()} onClick={() => run(k)}>
            + {t(KIND_KEY[k])}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
        <button type="button" className="btn btn-pri btn-sm" disabled={pending || (!amount.trim() && !lastAsk && !lastOur && current == null)} onClick={() => run("accept")}>
          ✓ {t("pr.accept")}{!amount.trim() && lastAny ? ` ${fa(lastAny.price, lastAny.currency)}` : ""}
        </button>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run("defer", false)}>⏸ {t("pr.defer")}</button>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run("decline", false)}>✕ {t("pr.decline")}</button>
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
    </section>
  );
}
