import { redirect } from "next/navigation";
import { createTeam } from "@/app/actions/team";
import { signOut } from "@/app/actions/auth";
import { listMyTeams } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import LangSwitch from "@/components/LangSwitch";

type Search = Promise<{ error?: string }>;

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const teams = await listMyTeams();
  if (teams.length > 0) redirect("/app");
  const sp = await searchParams;
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <p className="font-logo text-2xl font-bold tracking-tight">
          Link<span className="text-accent">Bro</span>
        </p>
        <LangSwitch />
      </div>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("onb.title")}</h1>
        <p className="mt-1 text-mute">{t("onb.lead")}</p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}

      <form action={createTeam} className="card flex flex-col gap-4">
        <div className="field">
          <label htmlFor="name" className="lbl">{t("onb.teamName")}</label>
          <input id="name" name="name" className="inp" placeholder={t("onb.teamPlaceholder")} maxLength={100} required />
        </div>
        <button type="submit" className="btn btn-pri">{t("onb.create")}</button>
      </form>

      <form action={signOut}>
        <button type="submit" className="text-sm text-mute underline">{t("auth.logoutAccount")}</button>
      </form>
    </main>
  );
}
