// Заметка хранится кодом "lc.key|параметр", текст подставляется на языке интерфейса (noteText).
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

export type CheckDetail = {
  status: Exclude<LinkStatus, "" | "suspect">;
  note: string;
  http: number | null;
  finalUrl: string;
  found: boolean;
  href: string;
  anchor: string;
  rel: string;
  noindex: boolean;
  ms: number;
};

// Полная проверка: что ожидали и что нашли. allowNofollow — в сделке отмечено «nofollow допустимо».
export async function checkLinkDetail(articleUrl: string, pageUrl: string, anchors: string, opts: { allowNofollow?: boolean } = {}): Promise<CheckDetail> {
  const t0 = Date.now();
  const base = { http: null as number | null, finalUrl: "", found: false, href: "", anchor: "", rel: "", noindex: false };
  const done = (d: Partial<CheckDetail> & { status: CheckDetail["status"]; note: string }): CheckDetail => ({ ...base, ...d, ms: Date.now() - t0 });
  if (!articleUrl.trim()) return done({ status: "error", note: "lc.noArticle" });
  const target = targetOf(pageUrl);
  if (!target) return done({ status: "error", note: "lc.noPage" });

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
    return done({ status: "blocked", note: "lc.timeout" });
  } finally {
    clearTimeout(timer);
  }
  base.http = res.status;
  base.finalUrl = res.url || "";

  if (res.status === 404 || res.status === 410) return done({ status: "missing", note: `lc.notFound|${res.status}` });
  if ([401, 403, 429, 503].includes(res.status)) return done({ status: "blocked", note: `lc.blocked|${res.status}` });
  if (res.status >= 400) return done({ status: "error", note: `lc.http|${res.status}` });

  const html = (await res.text()).slice(0, 3_000_000);
  const xRobots = (res.headers.get("x-robots-tag") ?? "").toLowerCase();
  const metaRobots = [...html.matchAll(/<meta[^>]+name\s*=\s*["'](?:robots|googlebot)["'][^>]*>/gi)].map((m) => m[0].toLowerCase());
  base.noindex = xRobots.includes("noindex") || metaRobots.some((m) => /content\s*=\s*["'][^"']*noindex/.test(m));

  // Все ссылки на сайт клиента: точное совпадение страницы и «на сайт, но на другую страницу»
  const exact: { rel: string; text: string; href: string }[] = [];
  const other: { rel: string; text: string; href: string }[] = [];
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
    const rel = (attrs.match(/rel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    const item = { rel, text: decode(m[2]), href: u.toString() };
    if (!target.path || path === target.path) exact.push(item);
    else other.push(item);
  }

  if (exact.length === 0) {
    if (other.length) {
      const o = other[0];
      return done({ status: "target", note: `lc.target|${o.href.slice(0, 200)}`, found: true, href: o.href, anchor: o.text.slice(0, 200), rel: o.rel });
    }
    return done({ status: "missing", note: "lc.linkMissing" });
  }
  const first = exact[0];
  const seen = { found: true, href: first.href, anchor: first.text.slice(0, 200), rel: first.rel };
  if (base.noindex) return done({ status: "noindex", note: "lc.noindex", ...seen });

  const clean = opts.allowNofollow ? exact : exact.filter((f) => !/\b(nofollow|sponsored|ugc)\b/.test(f.rel));
  if (clean.length === 0) return done({ status: "nofollow", note: `lc.rel|${first.rel}`, ...seen });

  const expected = anchors
    .split(/[,;|\n]+/)
    .map((a) => decode(a))
    .filter(Boolean);
  if (expected.length > 0 && !clean.some((f) => expected.some((a) => f.text.includes(a)))) {
    return done({ status: "anchor", note: `lc.anchor|${clean[0].text.slice(0, 80)}`, ...seen, anchor: clean[0].text.slice(0, 200), rel: clean[0].rel });
  }
  const hit = clean.find((f) => !expected.length || expected.some((a) => f.text.includes(a))) ?? clean[0];
  return done({ status: "ok", note: "", found: true, href: hit.href, anchor: hit.text.slice(0, 200), rel: hit.rel });
}

export async function checkLink(articleUrl: string, pageUrl: string, anchors: string): Promise<CheckOutcome> {
  const d = await checkLinkDetail(articleUrl, pageUrl, anchors);
  return { status: d.status, note: d.note };
}

// Код заметки → текст на языке интерфейса. Старые заметки (обычный текст) показываются как есть.
export function noteText(note: string, t: import("@/lib/i18n/config").TFn): string {
  const m = note.match(/^(lc\.[a-zA-Z]+)(?:\|([\s\S]*))?$/);
  if (!m) return note;
  return t(m[1] as import("@/lib/i18n/config").MsgKey, { x: m[2] ?? "" });
}
