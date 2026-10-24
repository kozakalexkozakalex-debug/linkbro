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
