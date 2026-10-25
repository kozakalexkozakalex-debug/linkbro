import ModuleTabs from "@/components/ModuleTabs";
import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/global";
import SyncButton from "./SyncButton";
import ReadAllButton from "./ReadAllButton";

// Inbox: переписка всей команды, по одной строке на контакт (посредника).
// Новые входящие — сверху. Нажали — открывается контакт со всей перепиской по всем сделкам.
type Row = { id: string; channel: string; direction: string; subject: string; body: string; handle: string; created_at: string; is_read: boolean; donor_id: string | null; donor_ids: string[] | null };
type Thread = { handle: string; last: Row; unread: number; count: number; donors: Set<string>; loose: number };
const ICON: Record<string, string> = { email: "📧", telegram: "✈️", whatsapp: "💬", exchange: "🏪", call: "📞", note: "📝" };
const PAGE = 100;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ f?: string; n?: string }> }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();
  const [{ data }, { data: mail }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, channel, direction, subject, body, handle, created_at, is_read, donor_id, donor_ids")
      .eq("team_id", team.id)
      .neq("handle", "")
      .neq("channel", "note")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("mail_accounts").select("email").maybeSingle(),
  ]);

  // Группируем по контакту: последнее сообщение, сколько непрочитанных, по скольким сделкам
  const map = new Map<string, Thread>();
  for (const r of (data ?? []) as Row[]) {
    let th = map.get(r.handle);
    if (!th) {
      th = { handle: r.handle, last: r, unread: 0, count: 0, donors: new Set(), loose: 0 };
      map.set(r.handle, th);
    }
    th.count++;
    if (!r.is_read && r.direction === "in") th.unread++;
    const ids = [...(r.donor_ids ?? []), ...(r.donor_id ? [r.donor_id] : [])];
    for (const id of ids) th.donors.add(id);
    if (!ids.length && r.direction === "in") th.loose++;
  }
  const all = [...map.values()];
  const unreadTotal = all.reduce((a, th) => a + th.unread, 0);
  const filter = sp.f === "all" || sp.f === "new" ? sp.f : unreadTotal ? "new" : "all";
  const threads = (filter === "new" ? all.filter((th) => th.unread) : all).sort(
    (a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.last.created_at.localeCompare(a.last.created_at),
  );
  const limit = Math.max(PAGE, Number(sp.n) || PAGE);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ModuleTabs module="outreach" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.inbox")}</h1>
          <p className="mt-1 text-mute">{unreadTotal ? t("inbox.unread", { n: unreadTotal }) : t("inbox.allRead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadTotal > 0 && <ReadAllButton />}
          {mail ? <SyncButton /> : <Link href="/app/mail" className="btn btn-pri">{t("mail.connect")}</Link>}
        </div>
      </div>
      <div className="seg self-start">
        <Link href="/app/inbox?f=new" className={filter === "new" ? "seg-on" : ""}>{t("out.fNew")} {unreadTotal ? `· ${unreadTotal}` : ""}</Link>
        <Link href="/app/inbox?f=all" className={filter === "all" ? "seg-on" : ""}>{t("out.fAll")} · {all.length}</Link>
      </div>
      {threads.length === 0 ? (
        <p className="card text-center text-mute">{filter === "new" ? t("inbox.allRead") : t("deal.noLog")}</p>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {threads.slice(0, limit).map((th) => (
            <li key={th.handle}>
              <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(th.handle)}`} className={`flex gap-3 px-4 py-3 ${th.unread ? "bg-elev" : ""}`}>
                <span aria-hidden="true" className="pt-0.5">{ICON[th.last.channel] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${th.unread ? "font-semibold" : ""}`}>{th.handle}</span>
                    {th.unread > 0 && <span className="pill border-accent text-accent">{th.unread}</span>}
                    <span className="ml-auto shrink-0 font-mono text-xs text-mute">{fmtDateTime(th.last.created_at, intl)}</span>
                  </div>
                  <p className="truncate text-sm">
                    <span className="text-mute">{th.last.direction === "in" ? "↘ " : "↗ "}</span>
                    {th.last.subject || th.last.body}
                  </p>
                  <p className="text-xs text-mute">
                    {t("out.threadMeta", { n: th.count, d: th.donors.size })}
                    {th.loose > 0 && <span className="text-accent"> · {t("out.loose", { n: th.loose })}</span>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {threads.length > limit && (
        <Link href={`/app/inbox?f=${filter}&n=${limit + PAGE}`} className="btn self-center">
          {t("sheet.more", { shown: limit, total: threads.length })}
        </Link>
      )}
    </div>
  );
}
