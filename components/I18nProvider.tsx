"use client";

import { createContext, useContext, useMemo } from "react";
import { INTL, makeT, type Locale, type Messages, type TFn } from "@/lib/i18n/config";

type Ctx = { locale: Locale; t: TFn; intl: string };
const I18nCtx = createContext<Ctx | null>(null);

export default function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(messages), intl: INTL[locale] }), [locale, messages]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const v = useContext(I18nCtx);
  if (!v) throw new Error("I18nProvider missing");
  return v;
}
