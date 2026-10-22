"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/team";

// Ошибки Supabase → ключ словаря (текст подставит страница на языке пользователя)
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.err.badLogin";
  if (m.includes("already registered") || m.includes("already been registered")) return "auth.err.exists";
  if (m.includes("password") && m.includes("6")) return "auth.err.shortPassword";
  if (m.includes("email not confirmed")) return "auth.err.notConfirmed";
  if (m.includes("rate limit")) return "auth.err.rateLimit";
  if (m.includes("invalid") && m.includes("email")) return "auth.err.badEmail";
  return message;
}

function back(mode: "login" | "signup", next: string, error: string): never {
  const q = new URLSearchParams({ mode, next, error });
  redirect(`/login?${q.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("login", next, translate(error.message));

  redirect(next);
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (password.length < 6) back("signup", next, "auth.err.shortPassword");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) back("signup", next, translate(error.message));

  // Если в Supabase включено подтверждение почты, сессии ещё нет.
  if (!data.session) {
    const q = new URLSearchParams({ mode: "login", next, info: "auth.confirmSent" });
    redirect(`/login?${q.toString()}`);
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Вход через Google: Supabase отдаёт адрес страницы Google, после входа вернёт на /auth/callback
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data?.url) back("login", next, "auth.err.google");
  redirect(data.url);
}
