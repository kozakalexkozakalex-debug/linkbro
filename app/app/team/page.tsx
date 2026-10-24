import { headers } from "next/headers";
import { getTeamContext } from "@/lib/team";
import { createInvite, deleteInvite, removeMember } from "@/app/actions/team";
import CopyButton from "@/components/CopyButton";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";

type Search = Promise<{ error?: string }>;

type MemberRow = { user_id: string; role: "lead" | "builder"; created_at: string };
type ProfileRow = { id: string; email: string | null; full_name: string | null };
type InviteRow = { id: string; token: string; role: "lead" | "builder"; expires_at: string; used_at: string | null };


export default async function TeamPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, user, team } = await getTeamContext();
  const { t, intl } = await getI18n();
  const fmt = (s: string) => new Date(s).toLocaleDateString(intl, { day: "2-digit", month: "2-digit", year: "numeric" });
  const roleName = (r: string) => (r === "lead" ? t("common.lead") : t("common.builder"));
  const isLead = team.role === "lead";

  const { data: membersData } = await supabase
    .from("team_members")
    .select("user_id, role, created_at")
    .eq("team_id", team.id)
    .order("created_at");
  const members = (membersData ?? []) as MemberRow[];

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", members.map((m) => m.user_id));
  const profiles = new Map(((profilesData ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  let invites: InviteRow[] = [];
  if (isLead) {
    const { data } = await supabase
      .from("team_invites")
      .select("id, token, role, expires_at, used_at")
      .eq("team_id", team.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    invites = (data ?? []) as InviteRow[];
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("team.title")}</h1>
        <p className="mt-1 text-mute">{t("team.subtitle", { name: team.name, n: members.length })}</p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}

      <section className="card">
        <p className="lbl mb-3">{t("team.members")}</p>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const p = profiles.get(m.user_id);
            const isMe = m.user_id === user.id;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p?.full_name || p?.email || "—"} {isMe && <span className="text-mute">{t("common.you")}</span>}
                  </p>
                  {p?.full_name && <p className="truncate text-sm text-mute">{p.email}</p>}
                </div>
                <span className={`pill ${m.role === "lead" ? "pill-ok" : ""}`}>
                  {roleName(m.role)}
                </span>
                {isLead && !isMe && (
                  <form action={removeMember}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <button type="submit" className="btn btn-sm">{t("common.delete")}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isLead && (
        <section className="card flex flex-col gap-4">
          <div>
            <p className="lbl">{t("team.invite")}</p>
            <p className="mt-1 text-sm text-mute">
              {t("team.inviteHint")}
            </p>
          </div>

          <form action={createInvite} className="flex flex-wrap items-end gap-2">
            <div className="field">
              <label htmlFor="role" className="lbl">{t("team.role")}</label>
              <select id="role" name="role" className="inp" defaultValue="builder">
                <option value="builder">{t("common.builder")}</option>
                <option value="lead">{t("common.lead")}</option>
              </select>
            </div>
            <button type="submit" className="btn btn-pri">{t("team.createLink")}</button>
          </form>

          {invites.length > 0 && (
            <ul className="flex flex-col gap-3">
              {invites.map((inv) => {
                const link = `${origin}/invite/${inv.token}`;
                return (
                  <li key={inv.id} className="rounded-md border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-mute">
                      <span className="pill">{roleName(inv.role)}</span>
                      <span>{t("team.validUntil", { date: fmt(inv.expires_at) })}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id={`invite-${inv.id}`}
                        aria-label={t("team.inviteLink")}
                        readOnly
                        value={link}
                        className="inp min-w-0 flex-1 font-mono text-xs"
                      />
                      <CopyButton text={link} />
                      <form action={deleteInvite}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button type="submit" className="btn btn-sm">{t("common.cancel")}</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
