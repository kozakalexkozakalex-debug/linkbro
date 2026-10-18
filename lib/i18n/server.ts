// Язык текущего запроса: cookie → язык браузера → украинский.
import { cookies, headers } from "next/headers";
import { INTL, LANG_COOKIE, fromAcceptLanguage, isLocale, makeT, type Locale } from "./config";
import { MESSAGES } from "./messages";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return fromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getI18n() {
  const locale = await getLocale();
  const messages = MESSAGES[locale];
  return { locale, messages, t: makeT(messages), intl: INTL[locale] };
}
