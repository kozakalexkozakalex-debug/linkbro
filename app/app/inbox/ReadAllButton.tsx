"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllRead } from "../outreach/actions";
import { useI18n } from "@/components/I18nProvider";

export default function ReadAllButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllRead();
          router.refresh();
        })
      }
    >
      {pending ? "…" : t("out.readAll")}
    </button>
  );
}
