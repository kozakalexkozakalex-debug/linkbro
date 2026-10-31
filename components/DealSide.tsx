"use client";

// Панель сделки сбоку от таблицы «Угоди»: где мы сейчас и что произошло — без открытия большой карточки.
//   Зверху — коротко: етап, чи відповів, ланцюжок листів, ціна, що далі.
//   Нижче — хронологія: листи (ми / нам), записи з Telegram/WhatsApp, ціни, оплати, публікація.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import StepPath from "@/components/StepPath";
import Icon from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import { getDealPanel, type DealPanel } from "@/app/app/projects/deal-actions";
import { markRead, sendDealEmail } from "@/app/app/mail/actions";
import { DEAL_STEP_KEY, dealNext, dealPath } from "@/lib/deal";
import { STAGE_KEY, stageOf } from "@/lib/stages";
import { SEQ_TONE, seqText } from "@/lib/seq";
import { fmtAmount } from "@/lib/money";
import type { ProjectDonor } from "@/lib/project";
import type { MsgKey } from "@/lib/i18n/config";

type Item = { at: string; kind: "out" | "in" | "log" | "note" | "price" | "pay" | "mile"; title: string; body?: string; tone?: string; actId?: string };

const CH: Record<string, string> = { email: "Email", telegram: "Telegram", whatsapp: "WhatsApp", exchange: "Біржа", call: "Дзвінок", note: "" };
const DAY = 86_400_000;

export default function DealSide({ donor, onClose, onOpenCard }: { donor: ProjectDonor; onClose: () => void; onOpenCard: (tab: "chat" | "prices" | "article") => void }) {
  const { t, intl } = useI18n();
  const [panel, setPanel] = useState<DealPanel | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // Диалог: вся переписка пузырями + ответ прямо отсюда
  const [mode, setMode] = useState<"overview" | "dialog">("overview");
  const [focus, setFocus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const dialogEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getDealPanel(donor.id, donor.domain, donor.med_base)
      .then(setPanel)
      .catch(() => setPanel(null));
  }, [donor.id, donor.domain, donor.med_base]);
  useEffect(() => {
    setPanel(null);
    load();
    markRead(donor.id).catch(() => undefined);
  }, [donor.id, load]);

  const toDialog = (id?: string) => {
    setFocus(id ?? null);
    setMode("dialog");
  };
  useEffect(() => {
    if (mode !== "dialog" || !panel) return;
    const el = focus ? document.getElementById(`msg-${focus}`) : dialogEnd.current;
    setTimeout(() => el?.scrollIntoView({ block: focus ? "center" : "end" }), 30);
  }, [mode, focus, panel]);

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
      else if (a.direction === "in") out.push({ at: a.created_at, kind: "in", actId: a.id, title: `${t("side.theyWrote")}${CH[a.channel] ? ` · ${CH[a.channel]}` : ""}`, body: a.subject ? `${a.subject} — ${snippet}` : snippet });
      else if (a.channel === "email") out.push({ at: a.created_at, kind: "out", actId: a.id, title: t("side.weWrote"), body: a.subject ? `${a.subject} — ${snippet}` : snippet });
      else out.push({ at: a.created_at, kind: "log", actId: a.id, title: `${t("side.weWrote")} · ${CH[a.channel] || a.channel}`, body: snippet });
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

  // ---------- Диалог ----------
  const msgs = [...acts].filter((a) => a.channel !== "note").reverse();
  const email = panel?.contact?.email || (/^[^@\s]+@[^@\s]+$/.test(donor.med_base.trim()) ? donor.med_base.trim() : "");
  const lastSubj = [...msgs].reverse().find((m) => m.subject)?.subject ?? `Guest post: ${donor.domain}`;
  const subject = /^re:/i.test(lastSubj) ? lastSubj : `Re: ${lastSubj}`;
  function send() {
    if (!draft.trim()) return;
    start(async () => {
      const r = await sendDealEmail({ projectId: donor.project_id, donorId: donor.id, to: email, subject, body: draft });
      if (!r.ok) return setErr(r.error);
      setErr(null);
      setDraft("");
      setFocus(null);
      load();
    });
  }
  // Рисуется вызовом функции (не компонентом), чтобы поле ответа не теряло фокус при наборе
  function dialog() {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode("overview")}>← {t("side.back")}</button>
          <span className="min-w-0 flex-1 truncate text-xs text-mute">{email || donor.med_base}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
          {!panel ? (
            [0, 1, 2].map((i) => <div key={i} className="skel h-14" />)
          ) : msgs.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">{t("side.noMessages")}</p>
          ) : (
            msgs.map((m) => {
              const mine = m.direction !== "in";
              return (
                <div key={m.id} id={`msg-${m.id}`} className={`bubble ${mine ? "bubble-out" : "bubble-in"} ${focus === m.id ? "bubble-focus" : ""}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px] text-mute">
                    <span>{mine ? t("side.you") : donor.med_base || t("side.theyWrote")}{CH[m.channel] && m.channel !== "email" ? ` · ${CH[m.channel]}` : ""}</span>
                    <span className="font-mono" suppressHydrationWarning>{dt(m.created_at)}</span>
                  </div>
                  {m.subject && <p className="mb-1 text-xs font-semibold">{m.subject}</p>}
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed [overflow-wrap:anywhere]">{m.body}</p>
                </div>
              );
            })
          )}
          <div ref={dialogEnd} />
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
          {panel && !panel.mail ? (
            <p className="text-xs text-mute">{t("mail.notConnected")}</p>
          ) : panel && !email ? (
            <p className="text-xs text-mute">{t("side.noEmail")}</p>
          ) : (
            <>
              <p className="truncate text-[11px] text-mute">{subject}</p>
              <textarea
                className="inp min-h-20 text-[13px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("side.replyPh")}
                aria-label={t("side.replyPh")}
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()}
              />
            </>
          )}
          {err && <p className="note note-bad">{err}</p>}
          <div className="flex gap-2">
            {panel?.mail && email && (
              <button type="button" className="btn btn-pri flex-1" disabled={sending || !draft.trim()} onClick={send}>
                <Icon name="mail" size={14} />
                {t("side.send")}
              </button>
            )}
            <button type="button" className="btn" onClick={() => onOpenCard("chat")}>{t("side.openCard")}</button>
          </div>
        </div>
      </>
    );
  }

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

      {mode === "dialog" ? (
        dialog()
      ) : (
      <div className="flex-1 overflow-y-auto">
        {/* Де зараз */}
        <section className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <StepPath compact steps={path.steps.map((x) => ({ label: t(DEAL_STEP_KEY[x.key]), mark: x.mark, title: t(DEAL_STEP_KEY[x.key]) }))} />
          <dl className="side-facts">
            <dt>{t("side.stage")}</dt>
            <dd className={path.lost ? "text-bad" : ""}>{t(STAGE_KEY[st])}</dd>
            <dt>{t("side.reply")}</dt>
            <dd className={panel ? reply.tone : "text-mute"}>
              {panel && (lastIn || lastOut) ? (
                <button type="button" className="text-left underline decoration-dotted underline-offset-2" onClick={() => toDialog()}>{reply.text}</button>
              ) : panel ? reply.text : "…"}
            </dd>
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
                      {it.actId ? (
                        <button type="button" className="side-tl-body side-tl-msg line-clamp-2" onClick={() => toDialog(it.actId)} title={t("side.openDialog")}>
                          {it.body || t("side.openDialog")}
                        </button>
                      ) : (
                        it.body && (
                          <button type="button" className={`side-tl-body ${open === id ? "" : "line-clamp-2"}`} onClick={() => setOpen(open === id ? null : id)} disabled={!long}>
                            {it.body}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
      )}

      {mode === "overview" && <footer className="flex gap-2 border-t border-line px-4 py-3">
        <button type="button" className="btn btn-pri flex-1" onClick={() => toDialog()}>
          <Icon name="chat" size={14} />
          {t("side.dialog")}
        </button>
        <button type="button" className="btn" onClick={() => onOpenCard("prices")}>{t("grp.prices")}</button>
        <button type="button" className="btn" onClick={() => onOpenCard("article")}>{t("deal.tabArticle")}</button>
      </footer>}
    </aside>
  );
}
