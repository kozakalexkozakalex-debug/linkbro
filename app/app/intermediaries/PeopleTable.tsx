"use client";

// База посередників: хто, як з ним звʼязатися, скільки в нього сайтів і угод, коли востаннє спілкувались.
// Натиснули — сторінка посередника з усією перепискою, сайтами й цінами (звідти ж можна написати).
import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

export type PersonRow = {
  handle: string;
  kind: string;
  name: string;
  email: string;
  telegram: string;
  whatsapp: string;
  sites: number;
  deals: number;
  live: number;
  published: number;
  last: string | null;
  replies: number;
};

const PER_PAGE = 100;

export default function PeopleTable({ rows }: { rows: PersonRow[] }) {
  const { t, intl } = useI18n();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PER_PAGE);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => [r.handle, r.name, r.email, r.telegram].some((x) => x.toLowerCase().includes(s))) : rows;
  }, [rows, q]);
  if (!rows.length) return <p className="card text-center text-mute">{t("ot.noPeople")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <input aria-label={t("common.search")} className="inp max-w-xs" placeholder={t("ot.searchPeople")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t("med.intermediary")}</th>
              <th>{t("deal.channels")}</th>
              <th>{t("ot.sites")}</th>
              <th>{t("ot.dealsCol")}</th>
              <th>{t("ot.replies")}</th>
              <th>{t("ot.last")}</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map((r) => (
              <tr key={r.handle}>
                <td className="max-w-64">
                  <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(r.handle)}`} className="block truncate font-semibold underline decoration-dotted">
                    {r.name || r.handle}
                  </Link>
                  {r.name && <span className="block truncate text-xs text-mute">{r.handle}</span>}
                </td>
                <td className="whitespace-nowrap text-sm">
                  {r.email && <span title={r.email}>📧 </span>}
                  {r.telegram && <span title={r.telegram}>✈️ </span>}
                  {r.whatsapp && <span title={r.whatsapp}>💬 </span>}
                  {r.kind === "exchange" && <span title={t("deal.kindExchange")}>🏪</span>}
                  {!r.email && !r.telegram && !r.whatsapp && r.kind !== "exchange" && <span className="text-xs text-accent">{t("ot.noChannel")}</span>}
                </td>
                <td className="font-mono">{r.sites || "—"}</td>
                <td className="whitespace-nowrap font-mono text-sm">
                  {r.deals ? (
                    <>
                      {r.live} <span className="text-mute">/ {r.published}🔗</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="font-mono">{r.replies || "—"}</td>
                <td className="whitespace-nowrap font-mono text-xs text-mute" suppressHydrationWarning>
                  {r.last ? new Date(r.last).toLocaleDateString(intl, { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > shown && (
        <button type="button" className="btn self-center" onClick={() => setShown(shown + PER_PAGE)}>{t("sheet.more", { shown, total: list.length })}</button>
      )}
    </div>
  );
}
