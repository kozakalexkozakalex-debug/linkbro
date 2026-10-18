"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkDonorLink } from "@/app/app/projects/actions";
import { fmtDate } from "@/lib/global";
import { LINK_STATUS, type LinkStatus } from "@/lib/project";
import { noteText } from "@/lib/linkcheck";
import { useI18n } from "@/components/I18nProvider";

const TONE = { ok: "pill-ok", bad: "pill-bad", warn: "pill-warn", "": "" } as const;

// Статус проверки опубликованной ссылки + кнопка «Перевірити зараз»
export default function LinkCheck({
  id,
  projectId,
  status,
  note,
  checkedAt,
  hasUrl,
}: {
  id: string;
  projectId: string;
  status: LinkStatus;
  note: string;
  checkedAt: string | null;
  hasUrl: boolean;
}) {
  const router = useRouter();
  const { t, intl } = useI18n();
  const [pending, start] = useTransition();
  const s = LINK_STATUS[status] ?? LINK_STATUS[""];

  if (!hasUrl) return <span className="text-xs text-mute">{t("lc.afterUrl")}</span>;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className={`pill ${TONE[s.tone]}`} title={[note ? noteText(note, t) : "", checkedAt ? t("global.checkedAt", { date: fmtDate(checkedAt, intl) }) : ""].filter(Boolean).join(" · ") || undefined}>
        {pending ? t("lc.checking") : t(s.key)}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={pending}
        title={t("lc.checkNow")}
        onClick={() =>
          start(async () => {
            await checkDonorLink(id, projectId);
            router.refresh();
          })
        }
      >
        ↻
      </button>
    </div>
  );
}
