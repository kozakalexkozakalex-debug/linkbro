// Языки интерфейса. Этот файл можно импортировать и на сервере, и в браузере.
import type { uk } from "@/messages/uk";

export const LOCALES = ["uk", "en", "ru", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uk";
export const LANG_COOKIE = "lb_lang";

export const LOCALE_NAMES: Record<Locale, string> = {
  uk: "Українська",
  en: "English",
  ru: "Русский",
  es: "Español",
};

// Формат дат, чисел и денег для каждого языка
export const INTL: Record<Locale, string> = {
  uk: "uk-UA",
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
};

export type Messages = { [K in keyof typeof uk]: string };
export type MsgKey = keyof typeof uk;
export type Vars = Record<string, string | number>;
export type TFn = (key: MsgKey, vars?: Vars) => string;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function makeT(messages: Messages): TFn {
  return (key, vars) => {
    let s = messages[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

// "en-US,en;q=0.9,uk;q=0.8" → первый поддерживаемый язык
export function fromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const code = part.trim().split(";")[0].slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
    if (code === "be") return "ru";
  }
  return "en";
}
