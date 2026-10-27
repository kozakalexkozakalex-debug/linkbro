"use server";

// Выбор проекта: запомнить в cookie и открыть нужный раздел.
// Через server action, а не ссылку: так перерисовывается всё (меню, вкладки), и браузер не «нажимает» проекты заранее.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SCOPE_COOKIE } from "@/lib/scope";
import { safeNext } from "@/lib/team";

export async function selectProject(formData: FormData) {
  const p = String(formData.get("p") ?? "all");
  const next = safeNext(formData.get("next"), "/app/domains");
  const jar = await cookies();
  if (p === "all") jar.delete(SCOPE_COOKIE);
  else jar.set(SCOPE_COOKIE, p.slice(0, 64), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: true });
  redirect(next);
}
