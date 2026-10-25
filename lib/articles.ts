// Производство статьи по сделке. Кто пишет определяет шаги:
//   ours (наш автор) и '' : ТЗ → Пишеться → Правки → Готова → У видавця → Видавець прийняв
//   ready (готовий текст):  ТЗ → Готова → У видавця → Видавець прийняв
//   publisher (пише видавець): ТЗ (анкор і сторінка) → У видавця → Видавець прийняв
// Начать статью можно только после «Погодили». Опубліковано — только с URL статьи (вкладка «Публікація»).
import type { MsgKey } from "@/lib/i18n/config";

export const ART_COLS = ["todo", "writing", "review", "ready", "sent", "accepted"] as const;
export type ArtStatus = (typeof ART_COLS)[number];
export type ArtMode = "" | "ours" | "publisher" | "ready";
export const ART_MODES: ArtMode[] = ["ours", "publisher", "ready"];

export const ART_KEY: Record<ArtStatus, MsgKey> = {
  todo: "art.cTodo",
  writing: "art.cWriting",
  review: "art.cReview",
  ready: "art.cReady",
  sent: "art.cSent",
  accepted: "art.cAccepted",
};
export const MODE_KEY: Record<Exclude<ArtMode, "">, MsgKey> = { ours: "art.mOurs", publisher: "art.mPublisher", ready: "art.mReady" };

export function stepsFor(mode: string): ArtStatus[] {
  if (mode === "publisher") return ["todo", "sent", "accepted"];
  if (mode === "ready") return ["todo", "ready", "sent", "accepted"];
  return [...ART_COLS];
}

// Этап сделки, до которого надо дотянуть при таком статусе статьи
export const ART_STAGE: Record<ArtStatus, string> = {
  todo: "agreed",
  writing: "writing",
  review: "review",
  ready: "review",
  sent: "sent",
  accepted: "sent",
};
