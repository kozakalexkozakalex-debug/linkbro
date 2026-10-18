"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, isLocale } from "@/lib/i18n/config";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true });
  revalidatePath("/", "layout");
}
