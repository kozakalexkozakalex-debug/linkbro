"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkDonorLink } from "@/app/app/projects/actions";
import { fmtDate } from "@/lib/global";
import { LINK_STATUS, type LinkStatus } from "@/lib/project";

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
  const [pending, start] = useTransition();
  const s = LINK_STATUS[status] ?? LINK_STATUS[""];

  if (!hasUrl) return <span className="text-xs text-mute">з&apos;явиться після Article URL</span>;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span className={`pill ${TONE[s.tone]}`} title={[note, checkedAt ? `перевірено ${fmtDate(checkedAt)}` : ""].filter(Boolean).join(" · ") || undefined}>
        {pending ? "перевіряю…" : s.label}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={pending}
        title="Перевірити зараз"
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
