"use client";

// Nexo: добавить посредника и его сайты вручную — один сайт или сразу список, который он прислал.
// Каждая строка: домен(ы) и цена через пробел/тире/двоеточие/запятую. Видно заранее, что распозналось.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNexoBatch } from "./nexo-actions";
import { parseDomainPrices, priceText } from "@/lib/nexo-parse";
import { CURRENCIES } from "@/lib/money";
import Icon from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";

export default function NexoAdd({ handles, onDone, startOpen = false }: { handles: string[]; onDone?: () => void; startOpen?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [who, setWho] = useState("");
  const [text, setText] = useState("");
  const [cur, setCur] = useState("USD");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parseDomainPrices(text, cur), [text, cur]);
  const priced = parsed.items.filter((x) => x.price != null).length;

  if (!open) {
    return (
      <button type="button" className="btn btn-pri self-start" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} />
        {t("nexo.add")}
      </button>
    );
  }

  function save() {
    start(async () => {
      const r = await addNexoBatch(who, text, cur);
      if (!r.ok) return setMsg({ ok: false, text: r.error ?? t("common.error") });
      setMsg({ ok: true, text: t("nexo.added", { n: r.added, p: r.priced }) });
      setText("");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <section className="card flex flex-col gap-3" aria-label={t("nexo.add")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{t("nexo.add")}</h2>
        <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={() => setOpen(false)}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <div className="field">
          <label htmlFor="nx-who" className="lbl">{t("med.intermediary")}</label>
          <input id="nx-who" className="inp" list="nx-handles" value={who} onChange={(e) => setWho(e.target.value)} placeholder={t("med.contactPh")} autoComplete="off" />
          <datalist id="nx-handles">
            {handles.slice(0, 500).map((h) => <option key={h} value={h} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="nx-cur" className="lbl">{t("nexo.defaultCur")}</label>
          <select id="nx-cur" className="inp" value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="nx-list" className="lbl">{t("nexo.list")}</label>
        <textarea id="nx-list" className="inp min-h-32 font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={"casinoguide.ua 120\nbetnews.pl — $90\nsportbuzz.de, 150 eur\nsite.com"} />
        <p className="text-xs text-mute">{t("nexo.listHint")}</p>
      </div>

      {parsed.items.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-mute">{t("nexo.preview", { n: parsed.items.length, p: priced })}</p>
          <ul className="max-h-40 overflow-y-auto rounded-md border border-line text-[13px]">
            {parsed.items.slice(0, 200).map((x) => (
              <li key={x.domain} className="flex justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                <span className="truncate font-mono">{x.domain}</span>
                <span className={`font-mono ${x.price == null ? "text-mute" : ""}`}>{priceText(x) || t("nexo.noPrice")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {parsed.bad.length > 0 && <p className="text-xs text-warn">{t("nexo.bad", { n: parsed.bad.length, x: parsed.bad.slice(0, 3).join(" · ") })}</p>}
      {msg && <p className={`note ${msg.ok ? "note-ok" : "note-bad"}`} role="status">{msg.text}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-pri" disabled={pending || !who.trim() || !parsed.items.length} onClick={save}>
          {t("nexo.save", { n: parsed.items.length })}
        </button>
      </div>
    </section>
  );
}
