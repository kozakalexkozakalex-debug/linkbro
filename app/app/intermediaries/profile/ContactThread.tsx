"use client";

// Переписка с контактом по всем сделкам сразу: каждое сообщение помечено доменом сделки.
// Здесь же — написать письмо (или отметить сообщение в Telegram/WhatsApp/на бирже) и привязать письмо «без сделки».
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { extractPrices, fillTemplate, type FillData } from "@/lib/outreach";
import { CURRENCIES } from "@/lib/money";
import { attachActivity, logContactMessage, markHandleRead, sendContactEmail, splitPrices } from "@/app/app/outreach/actions";
import type { Channel } from "@/app/app/projects/deal-actions";

export type ThreadDeal = { id: string; domain: string; project_id: string; project: string; stage: string; live: boolean; fill: FillData };
export type ThreadItem = {
  id: string;
  channel: Channel;
  direction: string;
  subject: string;
  body: string;
  created_at: string;
  donor_id: string | null;
  donor_ids?: string[] | null;
  message_id: string;
  is_read: boolean;
};

const ICON: Record<string, string> = { email: "📧", telegram: "✈️", whatsapp: "💬", exchange: "🏪", call: "📞", note: "📝" };
const PER_PAGE = 30;
const idsOf = (it: { donor_id: string | null; donor_ids?: string[] | null }) => [...new Set([...(it.donor_ids ?? []), ...(it.donor_id ? [it.donor_id] : [])])];

export default function ContactThread(props: {
  handle: string;
  email: string;
  mail: string | null;
  deals: ThreadDeal[];
  items: ThreadItem[];
  templates: { id: string; name: string; body: string }[];
}) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(props.items);
  const [shown, setShown] = useState(PER_PAGE);
  const [only, setOnly] = useState<string>(""); // фильтр ленты по сделке
  const live = props.deals.filter((d) => d.live);
  const byId = useMemo(() => new Map(props.deals.map((d) => [d.id, d])), [props.deals]);

  // Форма
  const [channel, setChannel] = useState<Channel>(props.email && props.mail ? "email" : "telegram");
  const [dir, setDir] = useState<"out" | "in">("out");
  const [dealId, setDealId] = useState<string>(live.length === 1 ? live[0].id : "");
  const [to, setTo] = useState(props.email);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setItems(props.items);
  }, [props.items]);

  // Открыли контакт — его новые сообщения прочитаны (без перерисовки страницы)
  useEffect(() => {
    if (props.items.some((i) => !i.is_read)) void markHandleRead(props.handle);
  }, [props.handle, props.items]);

  function applyTemplate(id: string) {
    const tpl = props.templates.find((x) => x.id === id);
    if (!tpl) return;
    const d = byId.get(dealId);
    setBody(fillTemplate(tpl.body, d?.fill ?? { domain: "" }));
    if (!subject && d) setSubject(d.domain);
  }

  function reply(it: ThreadItem) {
    setChannel(it.channel === "email" && props.mail ? "email" : it.channel);
    setDir("out");
    const ids = idsOf(it);
    if (ids.length === 1) setDealId(ids[0]);
    if (it.channel === "email") {
      setSubject(it.subject ? (/^re:/i.test(it.subject) ? it.subject : `Re: ${it.subject}`) : "");
      setReplyTo(it.message_id);
    }
    document.getElementById("ct-body")?.focus();
  }

  function submit() {
    setMsg(null);
    start(async () => {
      const r =
        channel === "email"
          ? await sendContactEmail({ handle: props.handle, donorId: dealId || null, to, subject, body, inReplyTo: replyTo })
          : await logContactMessage({ handle: props.handle, donorId: dealId || null, channel, direction: dir, body });
      if (!r.ok) return setMsg({ text: r.error, bad: true });
      setItems([
        {
          id: `tmp-${Date.now()}`,
          channel,
          direction: channel === "email" ? "out" : dir,
          subject: channel === "email" ? subject : "",
          body,
          created_at: new Date().toISOString(),
          donor_id: dealId || null,
          message_id: "",
          is_read: true,
        },
        ...items,
      ]);
      setBody("");
      setReplyTo("");
      setMsg({ text: channel === "email" ? t("out.sent") : t("common.saved") });
      if (dealId) router.refresh(); // у сделки сменился этап
    });
  }

  function attach(itemId: string, donorId: string) {
    if (!donorId) return;
    setItems(items.map((i) => (i.id === itemId ? { ...i, donor_id: donorId } : i)));
    start(async () => {
      const r = await attachActivity(itemId, donorId);
      if (!r.ok) return setMsg({ text: r.error, bad: true });
      router.refresh();
    });
  }

  const list = only ? items.filter((i) => (only === "none" ? !idsOf(i).length : idsOf(i).includes(only))) : items;
  const [split, setSplit] = useState<ThreadItem | null>(null);
  const isEmail = channel === "email";

  return (
    <>
      {/* ---------- Написать ---------- */}
      <section className="card flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="lbl mr-auto">{t("out.write")}</p>
          <div className="seg">
            {(["email", "telegram", "whatsapp", "exchange", "note"] as Channel[]).map((c) => (
              <button key={c} type="button" className={channel === c ? "seg-on" : ""} onClick={() => setChannel(c)} aria-pressed={channel === c} title={c}>
                {ICON[c]}
              </button>
            ))}
          </div>
        </div>
        <select aria-label={t("out.deal")} className="inp" value={dealId} onChange={(e) => setDealId(e.target.value)}>
          <option value="">{t("out.noDeal")}</option>
          {live.map((d) => (
            <option key={d.id} value={d.id}>
              {d.domain} · {d.project} · {d.stage}
            </option>
          ))}
        </select>
        {isEmail ? (
          !props.mail ? (
            <p className="text-sm text-mute">
              {t("mail.notConnected")} <Link href="/app/mail" className="underline">{t("mail.connect")}</Link>
            </p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label={t("out.to")} className="inp" placeholder={t("out.to")} value={to} onChange={(e) => setTo(e.target.value)} inputMode="email" />
                {props.templates.length > 0 && (
                  <select aria-label={t("nav.templates")} className="inp" value="" onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="">{t("out.useTemplate")}</option>
                    {props.templates.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <input aria-label={t("out.subject")} className="inp" placeholder={t("out.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </>
          )
        ) : (
          channel !== "note" && (
            <div className="seg self-start">
              <button type="button" className={dir === "out" ? "seg-on" : ""} onClick={() => setDir("out")}>↗ {t("out.weWrote")}</button>
              <button type="button" className={dir === "in" ? "seg-on" : ""} onClick={() => setDir("in")}>↘ {t("out.theyReplied")}</button>
            </div>
          )
        )}
        {(!isEmail || props.mail) && (
          <>
            <textarea id="ct-body" aria-label={t("out.text")} className="inp min-h-28 text-sm" placeholder={t("out.text")} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-pri" disabled={pending || !body.trim()} onClick={submit}>
                {pending ? "…" : isEmail ? t("out.send") : t("common.save")}
              </button>
              {replyTo && <span className="pill">↩ {t("out.replying")}</span>}
              {msg && <span className={`text-sm ${msg.bad ? "text-bad" : "text-mute"}`}>{msg.text}</span>}
            </div>
          </>
        )}
      </section>

      {/* ---------- Лента ---------- */}
      <section className="card flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="lbl mr-auto">{t("out.thread", { n: items.length })}</p>
          {props.deals.length > 0 && (
            <select aria-label={t("out.deal")} className="inp w-auto py-1 text-sm" value={only} onChange={(e) => { setOnly(e.target.value); setShown(PER_PAGE); }}>
              <option value="">{t("out.allDeals")}</option>
              <option value="none">{t("out.noDeal")}</option>
              {props.deals.map((d) => (
                <option key={d.id} value={d.id}>{d.domain}</option>
              ))}
            </select>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-mute">{t("deal.noLog")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.slice(0, shown).map((it) => {
              const ds = idsOf(it).map((id) => byId.get(id)).filter((x): x is ThreadDeal => !!x);
              const inc = it.direction === "in";
              return (
                <li key={it.id} className={`rounded-lg border border-line p-3 ${inc ? "bg-elev" : ""} ${inc && !it.is_read ? "border-accent" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span aria-hidden="true">{ICON[it.channel] ?? "•"}</span>
                    <span className={inc ? "font-semibold" : "text-mute"}>{inc ? `↘ ${t("out.in")}` : `↗ ${t("out.outMsg")}`}</span>
                    {ds.length ? (
                      <>
                        {ds.slice(0, 3).map((d) => <span key={d.id} className="pill font-mono">{d.domain}</span>)}
                        {ds.length > 3 && <span className="text-mute">+{ds.length - 3}</span>}
                      </>
                    ) : (
                      <span className="pill text-mute">{t("out.noDeal")}</span>
                    )}
                    <span className="ml-auto font-mono text-mute">{new Date(it.created_at).toLocaleString(intl, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {it.subject && <p className="mt-1 text-sm font-medium">{it.subject}</p>}
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{it.body.length > 1200 ? `${it.body.slice(0, 1200)}…` : it.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {inc && (
                      <button type="button" className="btn py-1 text-xs" onClick={() => reply(it)}>↩ {t("out.reply")}</button>
                    )}
                    {inc && live.length > 0 && !it.id.startsWith("tmp-") && (
                      <button type="button" className="btn py-1 text-xs" onClick={() => setSplit(it)}>💲 {t("out.split")}</button>
                    )}
                    {!idsOf(it).length && live.length > 0 && !it.id.startsWith("tmp-") && (
                      <select aria-label={t("out.attach")} className="inp w-auto py-1 text-xs" value="" onChange={(e) => attach(it.id, e.target.value)}>
                        <option value="">{t("out.attach")}</option>
                        {live.map((x) => (
                          <option key={x.id} value={x.id}>{x.domain}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > shown && (
          <button type="button" className="btn self-center" onClick={() => setShown(shown + PER_PAGE)}>
            {t("sheet.more", { shown, total: list.length })}
          </button>
        )}
      </section>
      {split && (
        <SplitDialog
          item={split}
          deals={live}
          onClose={() => setSplit(null)}
          onDone={() => {
            setSplit(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// «Розкласти ціни по угодах»: посредник прислал цены на несколько сайтов одним письмом —
// приложение само находит цену возле каждого домена, вы проверяете и сохраняете в историю каждой сделки.
function SplitDialog({ item, deals, onClose, onDone }: { item: ThreadItem; deals: ThreadDeal[]; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const found = extractPrices(`${item.subject}\n${item.body}`, deals.map((d) => d.domain));
  const linked = new Set(idsOf(item));
  const [rows, setRows] = useState(() =>
    deals.map((d) => ({
      id: d.id,
      domain: d.domain,
      on: linked.has(d.id) || !!found[d.domain],
      price: found[d.domain] ? String(found[d.domain]!.price) : "",
      currency: found[d.domain]?.currency ?? "USD",
    })),
  );
  const upd = (id: string, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.on && r.price.trim());
  const save = () =>
    start(async () => {
      const r = await splitPrices({
        projectIds: Object.fromEntries(deals.map((d) => [d.id, d.project_id])),
        items: chosen.map((x) => ({ donorId: x.id, price: x.price, currency: x.currency })),
        activityId: item.id,
      });
      if (!r.ok) return setErr(r.error);
      onDone();
    });
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card flex w-full max-w-lg flex-col gap-3" role="dialog" aria-label={t("out.split")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">{t("out.split")}</p>
            <p className="text-sm text-mute">{t("out.splitHint")}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-mute">{t("out.splitText")}</summary>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-bg p-2 text-xs">{item.body}</p>
        </details>
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_96px_76px] items-center gap-2 py-1.5">
              <input type="checkbox" aria-label={r.domain} checked={r.on} onChange={(e) => upd(r.id, { on: e.target.checked })} />
              <span className="truncate font-mono text-sm">{r.domain}</span>
              <input aria-label={t("pr.amount")} className="inp py-1" inputMode="decimal" value={r.price} placeholder="—" onChange={(e) => upd(r.id, { price: e.target.value, on: true })} />
              <select aria-label={t("common.currency")} className="inp py-1" value={r.currency} onChange={(e) => upd(r.id, { currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-pri" disabled={pending || !chosen.length} onClick={save}>
            {pending ? "…" : t("out.splitSave", { n: chosen.length })}
          </button>
          {err && <span className="text-sm text-bad">{err}</span>}
        </div>
      </div>
    </div>
  );
}
