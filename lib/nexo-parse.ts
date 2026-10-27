// Nexo: разбор списка доменов посредника. Одна строка — один или несколько доменов и (по желанию) цена:
//   casino.ua 120        betnews.pl — $90        site.com, 150 eur        a.com b.com 80        https://www.x.com/blog : 200 грн
// Разделитель между доменом и ценой — любой: пробел, тире, двоеточие, запятая, таб (как копируется из таблицы).
// Валюта: $ € ₴ £ или usd / eur / uah / грн / gbp рядом с числом; нет — берётся выбранная по умолчанию.
import { normalizeDomain } from "@/lib/global";

export type ParsedLine = { domain: string; price: number | null; currency: string };

const CUR: [RegExp, string][] = [
  [/\$|usd|дол/i, "USD"],
  [/€|eur|євро|евро/i, "EUR"],
  [/₴|uah|грн/i, "UAH"],
  [/£|gbp/i, "GBP"],
];

export function parseDomainPrices(text: string, defaultCur: string): { items: ParsedLine[]; bad: string[] } {
  const items = new Map<string, ParsedLine>();
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw.trim();
    if (!line) continue;
    // Домены: всё, что похоже на адрес сайта
    // (последняя часть адреса — с буквой, чтобы «12.5» не считался доменом)
    const tokens = (line.match(/(?:https?:\/\/)?[\p{L}\d-]+(?:\.[\p{L}\d-]+)+(?:\/[^\s,;]*)?/giu) ?? []).filter((x) =>
      /\p{L}/u.test(x.replace(/^https?:\/\//i, "").split("/")[0].split(".").pop() ?? ""),
    );
    const domains = tokens.map((x) => normalizeDomain(x)).filter((x): x is string => !!x);
    if (!domains.length) {
      bad.push(line);
      continue;
    }
    // Цена: первое число после удаления доменов
    let rest = line;
    for (const x of tokens) rest = rest.replace(x, " ");
    const m = rest.match(/(\d[\d\s]*(?:[.,]\d+)?)/);
    const n = m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : NaN;
    const price = Number.isFinite(n) && n > 0 ? n : null;
    const currency = CUR.find(([re]) => re.test(rest))?.[1] ?? defaultCur;
    for (const d of domains) items.set(d, { domain: d, price, currency });
  }
  return { items: [...items.values()], bad };
}

export const priceText = (p: ParsedLine) => (p.price == null ? "" : `${p.price} ${p.currency}`);
