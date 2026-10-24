import ModuleTabs from "@/components/ModuleTabs";
import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/global";
import SyncButton from "./SyncButton";

// «Переписка»: последние письма и сообщения по всем сделкам, новые входящие — сверху
type Row = { id: string; channel: string; direction: string; subject: string; body: string; handle: string; created_at: string; is_read: boolean; project_id: string | null; donor_id: string | null };
const ICON: Record<string, string> = { email: "📧", telegram: "✈️", whatsapp: "💬", exchange: "🏪", call: "📞", note: "📝" };

export default async function InboxPage() {
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();
  const [{ data }, { data: mail }] = await Promise.all([
    supabase.from("activities").select("id, channel, direction, subject, body, handle, created_at, is_read, project_id, donor_id").eq("team_id", team.id).order("created_at", { ascending: false }).limit(150),
    supabase.from("mail_accounts").select("email").maybeSingle(),
  ]);
  const rows = ((data ?? []) as Row[]).sort((a, b) => Number(a.is_read) - Number(b.is_read));
  const donorIds = [...new Set(rows.map((r) => r.donor_id).filter(Boolean))] as string[];
  const { data: dd } = donorIds.length
    ? await supabase.from("project_donors").select("id, domain").eq("team_id", team.id).in("id", donorIds)
    : { data: [] };
  const domain = new Map(((dd ?? []) as { id: string; domain: string }[]).map((d) => [d.id, d.domain]));
  const unread = rows.filter((r) => !r.is_read).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ModuleTabs module="outreach" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.inbox")}</h1>
          <p className="mt-1 text-mute">{unread ? t("inbox.unread", { n: unread }) : t("inbox.allRead")}</p>
        </div>
        {mail ? <SyncButton /> : <Link href="/app/mail" className="btn btn-pri">{t("mail.connect")}</Link>}
      </div>
      {rows.length === 0 ? (
        <p className="card text-center text-mute">{t("deal.noLog")}</p>
      ) : (
        <ul className="card divide-y divide-line p-0">
          {rows.map((r) => {
            const dom = r.donor_id ? domain.get(r.donor_id) : undefined;
            const href = r.project_id && dom ? `/app/projects/${r.project_id}?tab=work&q=${encodeURIComponent(dom)}` : undefined;
            const inner = (
              <div className={`flex gap-3 px-4 py-3 ${r.is_read ? "" : "bg-elev"}`}>
                <span aria-hidden="true" className="pt-0.5">{ICON[r.channel] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${r.is_read ? "" : "font-semibold"}`}>{r.direction === "in" ? "↘ " : "↗ "}{r.handle || "—"}</span>
                    {dom && <span className="pill max-sm:hidden">{dom}</span>}
                    <span className="ml-auto shrink-0 font-mono text-xs text-mute">{fmtDateTime(r.created_at, intl)}</span>
                  </div>
                  {r.subject && <p className="truncate text-sm font-medium">{r.subject}</p>}
                  <p className="line-clamp-2 text-sm text-mute">{r.body}</p>
                </div>
              </div>
            );
            return <li key={r.id}>{href ? <Link href={href}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
