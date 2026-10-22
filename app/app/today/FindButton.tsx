"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findIntermediaries } from "../projects/actions";
import { useI18n } from "@/components/I18nProvider";

export default function FindButton({ projectId, label }: { projectId: string; label: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await findIntermediaries(projectId);
            setMsg(r.error ?? t("work.found", { found: r.found, missing: r.missing }));
            router.refresh();
          })
        }
      >
        {label}
      </button>
      {msg && <span className="text-xs text-mute">{msg}</span>}
    </span>
  );
}
