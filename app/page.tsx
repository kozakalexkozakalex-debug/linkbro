import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <p className="font-display text-2xl font-bold tracking-tight">
        Link<span className="text-accent">Bro</span>
      </p>
      <h1 className="font-display text-xl font-medium text-balance">CRM для команд лінкбілдерів</h1>
      <p className="text-mute">
        Донори проходять шлях від інпуту до опублікованої статті, а тімлід бачить план, факт і витрати по кожному проєкту.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/login?mode=signup" className="btn btn-pri">Зареєструватися</Link>
        <Link href="/login" className="btn">Увійти</Link>
      </div>
    </main>
  );
}
