"use client";

// Панель сделки сбоку от таблицы «Угоди»: где мы сейчас и что произошло — без открытия большой карточки.
//   Зверху — коротко: етап, чи відповів, ланцюжок листів, ціна, що далі.
//   Нижче — хронологія: листи (ми / нам), записи з Telegram/WhatsApp, ціни, оплати, публікація.
import { useEffect, useMemo, useState } from "react";
import StepPath from "@/components/StepPath";
import Icon from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { getDealPanel, type DealPanel } from "@/app/app/projects/deal-actions";
import { markRead } from "@/app/app/mail/actions";
import { DEAL_STEP_KEY, dealNext, dealPath } from "@/lib/deal";
import { STAGE_KEY, stageOf } from "@/lib/stages";
import { SEQ_TONE, seqText } from "@/lib/seq";
import { fmtAmount } from "@/lib/money";
import type { ProjectDonor } from "@/lib/project";
import type { MsgKey } from "@/lib/i18n/config";

type Item = { at: string; kind: "out" | "in" | "log" | "note" | "price" | "pay" | "mile"; title: string; body?: string; tone?: string };

const CH: Record<string, string> = { email: "Email", telegram: "Telegram", whatsapp: "WhatsApp", exchange: "Біржа", call: "Дзвінок", note: "" };
const DAY = 86_400_000;

export default function DealSide({ donor, onClose, onOpenCard }: { donor: ProjectDonor; onClose: () => void; onOpenCard: (tab: "chat" | "prices" | "article") => void }) {
  const { t, intl } = useI18n();
  const [panel, setPanel] = useState<DealPanel | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setPanel(null);
    getDealPanel(donor.id, donor.domain, donor.med_base)
      .then(setPanel)
      .catch(() => setPanel(null));
    markRead(donor.id).catch(() => undefined);
  }, [donor.id, donor.domain, donor.med_base]);

  // Отодвинуть таблицу, чтобы панель её не закрывала (только на широком экране)
  useEffect(() => {
    document.documentElement.setAttribute("data-side-open", "");
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.documentElement.removeAttribute("data-side-open");
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const date = (s: string) => new Date(s).toLocaleDateString(intl, { day: "2-digit", month: "2-digit" });
  const dt = (s: string) => new Date(s).toLocaleString(intl, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const daysAgo = (s: string) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / DAY));
  const money = (n: number, c: string) => fmtAmount(n, c || "USD", intl);

  const path = dealPath(donor);
  const next = dealNext(donor);
  const st = stageOf(donor);
  const seq = seqText(donor, t);

  // Чи відповів: останній лист від нас проти останнього від нього
  const acts = panel?.activities ?? [];
  const lastIn = acts.find((a) => a.direction === "in");
  const lastOut = acts.find((a) => a.direction !== "in" && a.channel !== "note");
  let reply: { text: string; tone: string };
  if (!lastIn && !lastOut) reply = { text: t("side.notWritten"), tone: "text-mute" };
  else if (lastIn && (!lastOut || lastIn.created_at > lastOut.created_at)) reply = { text: t("side.replied", { d: date(lastIn.created_at) }), tone: "text-accent" };
  else reply = { text: t("side.waiting", { n: daysAgo(lastOut!.created_at) }), tone: daysAgo(lastOut!.created_at) >= 3 ? "text-warn" : "text-ink-2" };

  const agreed = panel?.offers.find((o) => o.kind === "agreed");
  const price = agreed ? `${money(agreed.price, agreed.currency)} · ${t("side.agreed")}` : donor.gp_price != null ? money(donor.gp_price, donor.gp_currency) : "—";

  const items: Item[] = useMemo(() => {
    if (!panel) return [];
    const out: Item[] = [];
    for (const a of panel.activities) {
      const snippet = (a.body || "").replace(/\s+/g, " ").trim();
      if (a.channel === "note") out.push({ at: a.created_at, kind: "note", title: t("side.note"), body: snippet });
      else if (a.direction === "in") out.push({ at: a.created_at, kind: "in", title: `${t("side.theyWrote")}${CH[a.channel] ? ` · ${CH[a.channel]}` : ""}`, body: a.subject ? `${a.subject} — ${snippet}` : snippet });
      else if (a.channel === "email") out.push({ at: a.created_at, kind: "out", title: t("side.weWrote"), body: a.subject ? `${a.subject} — ${snippet}` : snippet });
      else out.push({ at: a.created_at, kind: "log", title: `${t("side.weWrote")} · ${CH[a.channel] || a.channel}`, body: snippet });
    }
    const KIND: Record<string, MsgKey> = { quote: "side.pQuote", counter: "side.pCounter", agreed: "side.pAgreed", extra: "side.pExtra" };
    for (const o of panel.offers.filter((x) => !x.donor_id || x.donor_id === donor.id))
      out.push({ at: o.created_at, kind: "price", title: `${t(KIND[o.kind] ?? "side.pQuote")}: ${money(o.price, o.currency)}`, body: [o.handle, o.note].filter(Boolean).join(" · ") });
    for (const p of panel.payments) out.push({ at: p.paid_at ?? p.created_at, kind: "pay", title: `${t("side.payment")}: ${money(p.amount, p.currency)}`, body: [p.payee, p.status].filter(Boolean).join(" · ") });
    out.push({ at: donor.added_at, kind: "mile", title: t("side.added") });
    if (donor.published_at) out.push({ at: donor.published_at, kind: "mile", title: t("side.published"), body: donor.article_url || "" });
    return out.sort((a, b) => b.at.localeCompare(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, donor.id, t]);

  const DOT: Record<Item["kind"], string> = { out: "var(--ink-2)", in: "var(--accent)", log: "var(--ink-2)", note: "var(--mute)", price: "var(--warn)", pay: "var(--ok)", mile: "var(--info)" };

  return (
    <aside className="deal-side" role="dialog" aria-label={donor.domain}>
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[15px] font-semibold">{donor.domain}</p>
          <p className="truncate text-xs text-mute">{donor.med_base || t("side.noContact")}</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => onOpenCard("chat")}>{t("side.openCard")}</button>
        <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
          <Icon name="x" size={14} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Де зараз */}
        <section className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <StepPath compact steps={path.steps.map((x) => ({ label: t(DEAL_STEP_KEY[x.key]), mark: x.mark, title: t(DEAL_STEP_KEY[x.key]) }))} />
          <dl className="side-facts">
            <dt>{t("side.stage")}</dt>
            <dd className={path.lost ? "text-bad" : ""}>{t(STAGE_KEY[st])}</dd>
            <dt>{t("side.reply")}</dt>
            <dd className={panel ? reply.tone : "text-mute"}>{panel ? reply.text : "…"}</dd>
            <dt>{t("side.sequence")}</dt>
            <dd className={seq ? SEQ_TONE[seq.tone] : "text-mute"}>{seq ? seq.text.replace(/^📨\s*/, "") : t("side.noSeq")}</dd>
            <dt>{t("common.price")}</dt>
            <dd className="font-mono">{panel ? price : "…"}</dd>
            {donor.next_action_at || donor.next_action ? (
              <>
                <dt>{t("deal.next")}</dt>
                <dd>{[donor.next_action_at ? date(donor.next_action_at) : "", donor.next_action].filter(Boolean).join(" · ")}</dd>
              </>
            ) : null}
          </dl>
          {next && (
            <button type="button" className={`btn ${path.lost ? "" : "btn-pri"} justify-start`} onClick={() => onOpenCard(next.tab === "pub" ? "article" : next.tab)}>
              <Icon name="arrow" size={14} />
              {t(next.key)}
            </button>
          )}
        </section>

        {/* Хронологія */}
        <section className="px-4 py-3">
          <p className="lbl mb-2">{t("side.history")}</p>
          {!panel ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-10" />)}
            </div>
          ) : (
            <ol className="side-tl">
              {items.map((it, i) => {
                const id = `${it.at}-${i}`;
                const long = (it.body ?? "").length > 140;
                return (
                  <li key={id}>
                    <span className="side-tl-dot" style={{ background: DOT[it.kind] }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-[13px] font-semibold ${it.kind === "in" ? "text-accent" : ""}`}>{it.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-mute" suppressHydrationWarning>{dt(it.at)}</span>
                      </div>
                      {it.body && (
                        <button type="button" className={`side-tl-body ${open === id ? "" : "line-clamp-2"}`} onClick={() => setOpen(open === id ? null : id)} disabled={!long}>
                          {it.body}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <footer className="flex gap-2 border-t border-line px-4 py-3">
        <button type="button" className="btn btn-pri flex-1" onClick={() => onOpenCard("chat")}>
          <Icon name="mail" size={14} />
          {t("side.write")}
        </button>
        <button type="button" className="btn" onClick={() => onOpenCard("prices")}>{t("grp.prices")}</button>
        <button type="button" className="btn" onClick={() => onOpenCard("article")}>{t("deal.tabArticle")}</button>
      </footer>
    </aside>
  );
}
