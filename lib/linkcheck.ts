// Проверка опубликованной ссылки: страница открывается, ссылка на месте,
// нет nofollow/sponsored/ugc, страница не закрыта от индексации, анкор совпадает.
import { normalizeDomain } from "@/lib/global";
import type { LinkStatus } from "@/lib/project";

export type CheckOutcome = { status: Exclude<LinkStatus, "">; note: string };

const UA = "Mozilla/5.0 (compatible; LinkBroBot/1.0; link monitoring)";

function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function targetOf(pageUrl: string): { host: string; path: string } | null {
  let s = pageUrl.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    const host = normalizeDomain(u.hostname);
    if (!host) return null;
    return { host, path: u.pathname.replace(/\/+$/, "").toLowerCase() };
  } catch {
    return null;
  }
}

function withProtocol(u: string): string {
  const s = u.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s;
}

export async function checkLink(articleUrl: string, pageUrl: string, anchors: string): Promise<CheckOutcome> {
  if (!articleUrl.trim()) return { status: "error", note: "Немає Article URL" };
  const target = targetOf(pageUrl);
  if (!target) return { status: "error", note: "Немає або неправильний Page URL" };

  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    res = await fetch(withProtocol(articleUrl), {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    return { status: "blocked", note: "Сайт не відповів за 12 секунд" };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404 || res.status === 410) return { status: "missing", note: `Сторінка статті не знайдена (${res.status})` };
  if ([401, 403, 429, 503].includes(res.status)) return { status: "blocked", note: `Сайт блокує автоматичну перевірку (${res.status}). Перевірте вручну.` };
  if (res.status >= 400) return { status: "error", note: `Сторінка віддає помилку ${res.status}` };

  const html = (await res.text()).slice(0, 3_000_000);

  const xRobots = (res.headers.get("x-robots-tag") ?? "").toLowerCase();
  const metaRobots = [...html.matchAll(/<meta[^>]+name\s*=\s*["'](?:robots|googlebot)["'][^>]*>/gi)].map((m) => m[0].toLowerCase());
  const noindex = xRobots.includes("noindex") || metaRobots.some((m) => /content\s*=\s*["'][^"']*noindex/.test(m));

  // Все ссылки на целевую страницу
  const found: { rel: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1];
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? attrs.match(/href\s*=\s*([^\s>]+)/i)?.[1];
    if (!href) continue;
    let u: URL;
    try {
      u = new URL(href.replace(/&amp;/g, "&"), res.url || withProtocol(articleUrl));
    } catch {
      continue;
    }
    if (normalizeDomain(u.hostname) !== target.host) continue;
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (target.path && path !== target.path) continue;
    const rel = (attrs.match(/rel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    found.push({ rel, text: decode(m[2]) });
  }

  if (found.length === 0) return { status: "missing", note: "Посилання на вашу сторінку не знайдено на сторінці статті" };
  if (noindex) return { status: "noindex", note: "Сторінка статті закрита від індексації (noindex)" };

  const clean = found.filter((f) => !/\b(nofollow|sponsored|ugc)\b/.test(f.rel));
  if (clean.length === 0) return { status: "nofollow", note: `rel="${found[0].rel}"` };

  const expected = anchors
    .split(/[,;|\n]+/)
    .map((a) => decode(a))
    .filter(Boolean);
  if (expected.length > 0 && !clean.some((f) => expected.some((a) => f.text.includes(a)))) {
    return { status: "anchor", note: `Анкор на сторінці: «${clean[0].text.slice(0, 80)}»` };
  }

  return { status: "ok", note: "" };
}
