"use client";

// Каналы связи посредника на его профиле
import { useState, useTransition } from "react";
import { saveContact, type Contact } from "../../projects/deal-actions";
import { useI18n } from "@/components/I18nProvider";

export default function ContactEditor({ initial }: { initial: Contact }) {
  const { t } = useI18n();
  const [c, setC] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const f = (k: keyof Contact) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });
  const tg = c.telegram.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
  return (
    <section className="card flex flex-col gap-2">
      <p className="lbl">{t("deal.channels")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label={t("deal.kind")} className="inp" value={c.kind} onChange={f("kind")}>
          <option value="intermediary">{t("deal.kindMed")}</option>
          <option value="owner">{t("deal.kindOwner")}</option>
          <option value="exchange">{t("deal.kindExchange")}</option>
        </select>
        <input aria-label={t("auth.name")} className="inp" placeholder={t("auth.name")} value={c.name} onChange={f("name")} />
        <input aria-label="Email" className="inp" placeholder="📧 email" value={c.email} onChange={f("email")} />
        <input aria-label="Telegram" className="inp" placeholder="✈️ @telegram" value={c.telegram} onChange={f("telegram")} />
        <input aria-label="WhatsApp" className="inp" placeholder="💬 WhatsApp +380…" value={c.whatsapp} onChange={f("whatsapp")} />
        <input aria-label={t("deal.other")} className="inp" placeholder={t("deal.other")} value={c.other} onChange={f("other")} />
      </div>
      <textarea aria-label={t("prof.notes")} className="inp min-h-16 text-sm" placeholder={t("prof.notes")} value={c.notes} onChange={f("notes")} />
      <label className={`flex items-center gap-2 text-sm ${c.do_not_contact ? "text-bad" : ""}`}>
        <input type="checkbox" checked={!!c.do_not_contact} onChange={(e) => setC({ ...c, do_not_contact: e.target.checked })} />
        ⛔ {t("seq.dnc")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-pri btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveContact(c);
              setMsg(r.ok ? { text: t("common.saved") } : { text: r.error, bad: true });
            })
          }
        >
          {t("common.save")}
        </button>
        {c.email && <a className="btn btn-sm" href={`mailto:${c.email}`}>📧</a>}
        {tg && <a className="btn btn-sm" href={`https://t.me/${tg}`} target="_blank" rel="noreferrer">✈️</a>}
        {c.whatsapp && <a className="btn btn-sm" href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">💬</a>}
        {msg && <span className={`text-sm ${msg.bad ? "text-bad" : "text-mute"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
