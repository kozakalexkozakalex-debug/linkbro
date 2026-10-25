// Общие помощники Outreach: email посредника и подстановка переменных в шаблон письма.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Куда писать: email из карточки контакта, иначе сам handle, если это email
export function emailOf(handle: string, contactEmail?: string | null): string {
  const e = (contactEmail ?? "").trim();
  if (EMAIL_RE.test(e)) return e;
  const h = handle.trim();
  return EMAIL_RE.test(h) ? h : "";
}

export type FillData = {
  domain: string;
  anchors?: string;
  page_url?: string;
  gp_price?: number | null;
  gp_currency?: string;
  article_deadline?: string | null;
};

// Те же переменные, что и в карточке сделки: {domain} {anchor} {page} {price} {deadline}
export function fillTemplate(tpl: string, d: FillData): string {
  return tpl
    .replaceAll("{domains}", d.domain)
    .replaceAll("{domain}", d.domain)
    .replaceAll("{anchor}", d.anchors ?? "")
    .replaceAll("{page}", d.page_url ?? "")
    .replaceAll("{price}", d.gp_price ? `${d.gp_price} ${d.gp_currency || "USD"}` : "")
    .replaceAll("{deadline}", d.article_deadline ? d.article_deadline.split("-").reverse().join(".") : "");
}

// К какой сделке относится входящее письмо: домен упомянут в теме/тексте → эта сделка
export function pickDeal<T extends { domain: string }>(deals: T[], subject: string, text: string): T | null {
  const hay = `${subject}\n${text}`.toLowerCase();
  const hit = deals.filter((d) => d.domain && hay.includes(d.domain.toLowerCase()));
  if (hit.length === 1) return hit[0];
  return null;
}

// Список доменов для письма по нескольким сайтам: "- a.com\n- b.com"
export function domainsList(domains: string[]): string {
  return domains.map((d) => `- ${d}`).join("\n");
}

// Шаблон для письма посреднику по нескольким доменам: {domains} → список, {domain} → первый домен
export function fillGroupTemplate(tpl: string, domains: string[]): string {
  return tpl.replaceAll("{domains}", domainsList(domains)).replaceAll("{domain}", domains[0] ?? "");
}

// Найти в ответе посредника цену для каждого домена: строка с доменом → первое число рядом с ним.
// "slotsreview.com — $320", "casinoguide.ua: 180 usd", "betnews.pl 90€". Не нашли — null (впишут руками).
export function extractPrices(text: string, domains: string[]): Record<string, { price: number; currency: string } | null> {
  const out: Record<string, { price: number; currency: string } | null> = {};
  const lines = text.split(/\r?\n/);
  for (const d of domains) {
    out[d] = null;
    const dl = d.toLowerCase();
    const line = lines.find((l) => l.toLowerCase().includes(dl));
    if (!line) continue;
    const rest = line.slice(line.toLowerCase().indexOf(dl) + dl.length);
    const m = rest.match(/([$€₴])?\s*(\d[\d\s.,]*\d|\d)\s*(usd|eur|uah|грн|\$|€|₴)?/i);
    if (!m) continue;
    const n = Number(m[2].replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    const sym = (m[1] || m[3] || "").toLowerCase();
    const currency = sym === "€" || sym === "eur" ? "EUR" : sym === "₴" || sym === "uah" || sym === "грн" ? "UAH" : "USD";
    out[d] = { price: n, currency };
  }
  return out;
}
