import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import LangSwitch from "@/components/LangSwitch";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-2xl font-bold tracking-tight">
          Link<span className="text-accent">Bro</span>
        </p>
        <LangSwitch />
      </div>
      <h1 className="font-display text-xl font-medium text-balance">{t("common.tagline")}</h1>
      <p className="text-mute">{t("home.lead")}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/login?mode=signup" className="btn btn-pri">{t("auth.signup")}</Link>
        <Link href="/login" className="btn">{t("auth.login")}</Link>
      </div>
    </main>
  );
}
