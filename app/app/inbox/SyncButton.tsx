"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMyMail } from "../mail/actions";
import { useI18n } from "@/components/I18nProvider";

export default function SyncButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-sm text-mute">{msg}</span>}
      <button
        type="button"
        className="btn btn-pri"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncMyMail(true);
            setMsg(r.error ? r.error : t("mail.synced", { n: r.added }));
            router.refresh();
          })
        }
      >
        {pending ? t("mail.syncing") : t("mail.syncNow")}
      </button>
    </div>
  );
}
