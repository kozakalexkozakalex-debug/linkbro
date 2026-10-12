// Разбор и сборка CSV (выгрузки Google Sheets, Ahrefs, Majestic, Excel).

export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const count = (ch: string) => {
    let n = 0;
    let q = false;
    for (const c of line) {
      if (c === '"') q = !q;
      else if (c === ch && !q) n++;
    }
    return n;
  };
  const cands = [",", ";", "\t"];
  return cands.reduce((best, c) => (count(c) > count(best) ? c : best), ",");
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const d = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === d) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

// Поля, которые можно загрузить в глобальную базу, и как их обычно называют в выгрузках
export const IMPORT_FIELDS = [
  { key: "domain", label: "Domain *", hints: ["domain", "url", "site", "сайт", "домен", "referring domain", "target", "host", "donor", "донор"] },
  { key: "price", label: "Price", hints: ["price", "ціна", "цена", "cost", "вартість", "стоимость"] },
  { key: "dr", label: "DR", hints: ["dr", "domain rating"] },
  { key: "keywords", label: "Keywords", hints: ["keywords", "organic keywords", "kw", "ключі", "ключи"] },
  { key: "traffic", label: "Traffic", hints: ["traffic", "organic traffic", "трафік", "трафик"] },
  { key: "geo", label: "GEO", hints: ["geo", "country", "top country", "країна", "страна"] },
  { key: "topics", label: "Topics", hints: ["topics", "topic", "topical trust flow topic", "тематика", "category"] },
  { key: "tf", label: "TF", hints: ["tf", "trust flow", "trustflow"] },
  { key: "cf", label: "CF", hints: ["cf", "citation flow", "citationflow"] },
] as const;
export type ImportKey = (typeof IMPORT_FIELDS)[number]["key"];

export function guessMapping(header: string[]): Partial<Record<ImportKey, number>> {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[_\-]+/g, " "));
  const out: Partial<Record<ImportKey, number>> = {};
  for (const f of IMPORT_FIELDS) {
    let idx = norm.findIndex((h) => (f.hints as readonly string[]).includes(h));
    if (idx < 0) idx = norm.findIndex((h) => (f.hints as readonly string[]).some((x) => x.length > 2 && h.includes(x)));
    if (idx >= 0 && !Object.values(out).includes(idx)) out[f.key] = idx;
  }
  return out;
}

// "1 234", "1,234", "12,5" → число
export function toNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.replace(/[\s ]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
