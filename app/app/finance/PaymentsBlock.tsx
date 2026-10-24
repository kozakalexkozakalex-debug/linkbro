"use client";

// Реестр выплат: кому, сколько, за что, оплачено или нет
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPayment, deletePayment, setPaymentStatus, type Payment } from "../projects/deal-actions";
import { CURRENCIES, fmtAmount } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

const KINDS = ["writer", "intermediary", "exchange", "other"] as const;
const KIND_KEY: Record<string, MsgKey> = { writer: "pay.kWriter", intermediary: "pay.kMed", exchange: "pay.kExchange", other: "pay.kOther" };

export default function PaymentsBlock({ rows, projects, isLead }: { rows: Payment[]; projects: { id: string; name: string }[]; isLead: boolean }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ payeeKind: "writer", payee: "", amount: "", currency: "USD", projectId: "", note: "" });
  const [showPaid, setShowPaid] = useState(false);
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const due = rows.filter((r) => r.status === "due");
  const list = showPaid ? rows : due;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setErr(r.ok ? null : r.error ?? null);
      router.refresh();
    });

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="lbl">{t("pay.title")} · {t("pay.dueCount", { n: due.length })}</p>
        <label className="flex items-center gap-2 text-sm text-mute">
          <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />
          {t("pay.showPaid")}
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-[140px_1fr_110px_90px]">
        <select aria-label={t("pay.kind")} className="inp" value={f.payeeKind} onChange={(e) => setF({ ...f, payeeKind: e.target.value })}>
          {KINDS.map((k) => <option key={k} value={k}>{t(KIND_KEY[k])}</option>)}
        </select>
        <input aria-label={t("pay.payee")} className="inp" placeholder={t("pay.payee")} value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} />
        <input aria-label={t("pay.amount")} className="inp" inputMode="decimal" placeholder={t("pay.amount")} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select aria-label={t("common.currency")} className="inp" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label={t("common.project")} className="inp sm:col-span-2" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
          <option value="">{t("common.project")}: —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input aria-label={t("pay.note")} className="inp" placeholder={t("pay.note")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button
          type="button"
          className="btn btn-pri"
          disabled={pending || !f.amount}
          onClick={() => run(async () => {
            const r = await addPayment({ ...f });
            if (r.ok) setF({ ...f, payee: "", amount: "", note: "" });
            return r;
          })}
        >
          {t("common.add")}
        </button>
      </div>
      {err && <p className="note note-bad">{err}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-mute">{t("fin.noDebts")}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.slice(0, 200).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="pill">{t(KIND_KEY[p.payee_kind] ?? "pay.kOther")}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{p.payee || "—"}</span>
              {p.project_id && <span className="text-xs text-mute max-sm:hidden">{pName.get(p.project_id)}</span>}
              {p.note && <span className="truncate text-xs text-mute max-sm:hidden">{p.note}</span>}
              <span className="font-mono">{fmtAmount(Number(p.amount), p.currency, intl)}</span>
              <button type="button" className={`pill ${p.status === "paid" ? "pill-ok" : "pill-bad"}`} disabled={pending} onClick={() => run(() => setPaymentStatus(p.id, p.status !== "paid"))}>
                {p.status === "paid" ? t("pay.paid") : t("pay.markPaid")}
              </button>
              {isLead && (
                <button type="button" className="text-xs text-mute" aria-label={t("common.delete")} onClick={() => run(() => deletePayment(p.id))}>✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
