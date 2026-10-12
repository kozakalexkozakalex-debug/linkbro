import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/team";

type Params = Promise<{ token: string }>;
type Search = Promise<{ error?: string }>;

export default async function InvitePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { token } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Сначала регистрация или вход, потом возвращаемся сюда же.
  if (!user) {
    const q = new URLSearchParams({ mode: "signup", next: `/invite/${token}` });
    redirect(`/login?${q.toString()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <p className="font-display text-2xl font-bold tracking-tight">
        Link<span className="text-accent">Bro</span>
      </p>
      <div>
        <h1 className="font-display text-xl font-medium">Запрошення в команду</h1>
        <p className="mt-1 text-mute">Ви увійшли як {user.email}. Натисніть, щоб приєднатися.</p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}

      <form action={acceptInvite} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-pri">Приєднатися до команди</button>
      </form>
      <Link href="/app" className="text-sm text-mute underline">Перейти до застосунку</Link>
    </main>
  );
}
