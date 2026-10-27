// Переключить проект: /app/scope?p=<id|all>&next=/app/outreach
import { NextResponse } from "next/server";
import { SCOPE_COOKIE } from "@/lib/scope";
import { safeNext } from "@/lib/team";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams.get("p") ?? "all";
  const next = safeNext(url.searchParams.get("next"), "/app");
  const res = NextResponse.redirect(new URL(next, url.origin));
  // Браузер заранее подгружает ссылки — такая подгрузка проект не меняет
  const h = request.headers;
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) return res;
  if (p === "all") res.cookies.delete(SCOPE_COOKIE);
  else res.cookies.set(SCOPE_COOKIE, p.slice(0, 64), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: true });
  return res;
}
