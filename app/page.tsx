// Стартовая страница-заглушка: показывает, что приложение собралось и видит Supabase.
// Позже здесь будет вход в аккаунт.

export const dynamic = "force-dynamic";

type Check = { ok: boolean; title: string; hint: string };

async function checkSupabase(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return {
      ok: false,
      title: "Ключи Supabase не добавлены",
      hint: "Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY в настройках Vercel и сделайте Redeploy.",
    };
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    if (res.ok) {
      return { ok: true, title: "Supabase подключён", hint: "Приложение видит базу данных. Можно переходить к следующему шагу." };
    }
    return {
      ok: false,
      title: `Supabase ответил ошибкой ${res.status}`,
      hint: "Скорее всего, ключ скопирован не полностью. Проверьте значение NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  } catch {
    return {
      ok: false,
      title: "Не удалось достучаться до Supabase",
      hint: "Проверьте адрес проекта в NEXT_PUBLIC_SUPABASE_URL: он должен выглядеть как https://xxxx.supabase.co",
    };
  }
}

export default async function Home() {
  const check = await checkSupabase();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <p className="font-display text-2xl font-bold tracking-tight">
        Link<span className="text-accent">Bro</span>
      </p>
      <h1 className="font-display text-xl font-medium text-balance">CRM для команд линкбилдеров</h1>

      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Проверка подключения</p>
        <p className="flex items-center gap-2 font-medium">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${check.ok ? "bg-ok" : "bg-bad"}`}
            aria-hidden="true"
          />
          {check.title}
        </p>
        <p className="mt-1 text-sm text-mute">{check.hint}</p>
      </div>

      <p className="font-mono text-xs text-mute">Этап 2 из 7 · каркас приложения</p>
    </main>
  );
}
