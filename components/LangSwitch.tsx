"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { useI18n } from "@/components/I18nProvider";

// Выбор языка интерфейса. dark — вариант для тёмного бокового меню.
export default function LangSwitch({ dark }: { dark?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1 text-xs">
      <span className="sr-only">{t("lang.label")}</span>
      <span aria-hidden="true">🌐</span>
      <select
        className={dark ? "side-select" : "inp w-auto py-1 text-xs"}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            await setLocale(v);
            router.refresh();
          });
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
        ))}
      </select>
    </label>
  );
}
