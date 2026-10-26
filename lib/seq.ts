// Состояние автоматической цепочки писем у сделки — коротким текстом для таблиц и карточки.
// Это отдельно от этапа сделки: сделка может быть «Переговори», а цепочка — «зупинено: відповів».
import type { MsgKey, TFn } from "@/lib/i18n/config";

type T = TFn;
type SeqDeal = { seq_status?: string; seq_step?: number; seq_next_at?: string | null };

export const LOST_REASONS = ["refused", "noreply", "badcontact", "noplacement", "price", "other"] as const;

export function seqText(d: SeqDeal, t: T): { text: string; tone: "run" | "ok" | "bad" | "mute" } | null {
  const st = d.seq_status || "";
  if (!st) return null;
  const step = d.seq_step ?? 0;
  if (st === "running") {
    if (step === 0) return { text: `📨 ${t("seq.queued")}`, tone: "run" };
    const days = d.seq_next_at ? Math.max(0, Math.ceil((new Date(d.seq_next_at).getTime() - Date.now()) / 86_400_000)) : 0;
    const sent = step === 1 ? t("seq.l1") : t("seq.l2", { n: step - 1 });
    const next = step >= 3 ? t("seq.close") : t("seq.rem", { n: step });
    return { text: `📨 ${sent} ✓ · ${next} ${days ? t("seq.inDays", { n: days }) : t("seq.today")}`, tone: "run" };
  }
  const key: Record<string, MsgKey> = { replied: "seq.sReplied", stopped: "seq.sStopped", done: "seq.sDone", bounced: "seq.sBounced", optout: "seq.sOptout" };
  const tone = st === "replied" ? "ok" : st === "bounced" || st === "optout" ? "bad" : "mute";
  return key[st] ? { text: `📨 ${t(key[st])}`, tone } : null;
}

export const SEQ_TONE = { run: "text-accent", ok: "text-ok", bad: "text-bad", mute: "text-mute" } as const;
