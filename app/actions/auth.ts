"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/team";

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Невірна пошта або пароль.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ця пошта вже зареєстрована. Увійдіть.";
  if (m.includes("password") && m.includes("6")) return "Пароль має бути не коротший за 6 символів.";
  if (m.includes("email not confirmed")) return "Пошту ще не підтверджено. Перевірте лист від Supabase.";
  if (m.includes("rate limit")) return "Забагато спроб. Зачекайте хвилину й спробуйте ще раз.";
  if (m.includes("invalid") && m.includes("email")) return "Перевірте адресу пошти.";
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

  if (password.length < 6) back("signup", next, "Пароль має бути не коротший за 6 символів.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) back("signup", next, translate(error.message));

  // Если в Supabase включено подтверждение почты, сессии ещё нет.
  if (!data.session) {
    const q = new URLSearchParams({ mode: "login", next, info: "Ми надіслали лист для підтвердження пошти. Підтвердіть і увійдіть." });
    redirect(`/login?${q.toString()}`);
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
