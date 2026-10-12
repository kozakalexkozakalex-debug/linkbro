import Link from "next/link";
import { signIn, signUp } from "@/app/actions/auth";
import { safeNext } from "@/lib/team";

type Search = Promise<{ mode?: string; next?: string; error?: string; info?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "login";
  const next = safeNext(sp.next);
  const q = (m: string) => `/login?${new URLSearchParams({ mode: m, next }).toString()}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="font-display text-2xl font-bold tracking-tight">
        Link<span className="text-accent">Bro</span>
      </Link>

      <div className="flex gap-1 border-b border-line">
        <Link href={q("login")} className={`tab ${mode === "login" ? "tab-on" : ""}`}>Вхід</Link>
        <Link href={q("signup")} className={`tab ${mode === "signup" ? "tab-on" : ""}`}>Реєстрація</Link>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}
      {sp.info && <p className="note note-ok" role="status">{sp.info}</p>}

      <form action={mode === "signup" ? signUp : signIn} className="card flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="full_name" className="lbl">Ім&apos;я</label>
            <input id="full_name" name="full_name" className="inp" autoComplete="name" required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email" className="lbl">Пошта</label>
          <input id="email" name="email" type="email" className="inp" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password" className="lbl">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            className="inp"
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {mode === "signup" && <span className="text-xs text-mute">Не менше 6 символів.</span>}
        </div>
        <button type="submit" className="btn btn-pri">
          {mode === "signup" ? "Створити акаунт" : "Увійти"}
        </button>
      </form>
    </main>
  );
}
