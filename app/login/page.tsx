import Link from "next/link";
import { signIn, signInWithGoogle, signUp } from "@/app/actions/auth";
import { safeNext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import LangSwitch from "@/components/LangSwitch";

type Search = Promise<{ mode?: string; next?: string; error?: string; info?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const mode = sp.mode === "signup" ? "signup" : "login";
  const next = safeNext(sp.next);
  const q = (m: string) => `/login?${new URLSearchParams({ mode: m, next }).toString()}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="font-logo text-2xl font-bold tracking-tight">
          Link<span className="text-accent">Bro</span>
        </Link>
        <LangSwitch />
      </div>

      <div className="flex gap-1 border-b border-line">
        <Link href={q("login")} className={`tab ${mode === "login" ? "tab-on" : ""}`}>{t("auth.tabLogin")}</Link>
        <Link href={q("signup")} className={`tab ${mode === "signup" ? "tab-on" : ""}`}>{t("auth.tabSignup")}</Link>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}
      {sp.info && <p className="note note-ok" role="status">{t(sp.info as MsgKey)}</p>}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="btn w-full justify-center gap-2">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24" />
            <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8" />
          </svg>
          {t("auth.google")}
        </button>
      </form>
      <p className="text-center text-xs text-mute">{t("auth.orEmail")}</p>

      <form action={mode === "signup" ? signUp : signIn} className="card flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="full_name" className="lbl">{t("auth.name")}</label>
            <input id="full_name" name="full_name" className="inp" autoComplete="name" required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email" className="lbl">{t("auth.email")}</label>
          <input id="email" name="email" type="email" className="inp" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password" className="lbl">{t("auth.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            className="inp"
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {mode === "signup" && <span className="text-xs text-mute">{t("auth.passwordHint")}</span>}
        </div>
        <button type="submit" className="btn btn-pri">
          {mode === "signup" ? t("auth.createAccount") : t("auth.login")}
        </button>
      </form>
    </main>
  );
}
