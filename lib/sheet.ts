// Логика таблицы «как в Google Sheets» без интерфейса: разбор буфера обмена, вставка, протягивание.

export type Opt = { value: string; label: string };
export type CellChange = { id: string; field: string; value: string };

export type GridCol = {
  key: string;
  editable: boolean;
  options?: Opt[] | null; // для выпадающих списков
};

export type Range = { r0: number; c0: number; r1: number; c1: number };

export function norm(a: { r: number; c: number }, b: { r: number; c: number }): Range {
  return { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
}

// Текст из Google Sheets / Excel → двумерный массив (табуляция между колонками, перевод строки между строками)
export function parseClipboard(text: string): string[][] {
  const t = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (t === "") return [[""]];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

export function toTsv(grid: string[][]): string {
  return grid.map((r) => r.map((v) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join("\t")).join("\n");
}

// Значение для выпадающего списка: принимает и код, и подпись (без учёта регистра)
export function matchOption(raw: string, options: Opt[] | null | undefined): string | null {
  if (!options) return raw;
  const v = raw.trim();
  if (v === "") return options.some((o) => o.value === "") ? "" : null;
  const lower = v.toLowerCase();
  const hit = options.find((o) => o.value.toLowerCase() === lower) ?? options.find((o) => o.label.toLowerCase() === lower);
  return hit ? hit.value : null;
}

type Getter = (r: number, c: number) => string;

// Вставка блока из буфера начиная с левого верхнего угла выделения.
// Одно значение при выделенном диапазоне → заливает весь диапазон.
export function buildPaste(
  grid: string[][],
  range: Range,
  rowIds: string[],
  cols: GridCol[],
  optionsFor: (r: number, c: number) => Opt[] | null | undefined,
): { changes: CellChange[]; skipped: number } {
  const changes: CellChange[] = [];
  let skipped = 0;
  const single = grid.length === 1 && grid[0].length === 1;
  const height = single ? range.r1 - range.r0 + 1 : grid.length;
  const width = single ? range.c1 - range.c0 + 1 : Math.max(...grid.map((r) => r.length));
  for (let i = 0; i < height; i++) {
    const r = range.r0 + i;
    if (r >= rowIds.length) break;
    for (let j = 0; j < width; j++) {
      const c = range.c0 + j;
      if (c >= cols.length) break;
      const raw = single ? grid[0][0] : grid[i]?.[j];
      if (raw === undefined) continue;
      if (!cols[c].editable) {
        skipped++;
        continue;
      }
      const val = matchOption(raw, optionsFor(r, c));
      if (val === null) {
        skipped++;
        continue;
      }
      changes.push({ id: rowIds[r], field: cols[c].key, value: val });
    }
  }
  return { changes, skipped };
}

// Протягивание вниз: повторяем выделенный блок до строки toRow включительно
export function buildFill(range: Range, toRow: number, rowIds: string[], cols: GridCol[], get: Getter): CellChange[] {
  const changes: CellChange[] = [];
  const h = range.r1 - range.r0 + 1;
  for (let r = range.r1 + 1; r <= Math.min(toRow, rowIds.length - 1); r++) {
    const src = range.r0 + ((r - range.r0) % h);
    for (let c = range.c0; c <= range.c1; c++) {
      if (!cols[c]?.editable) continue;
      changes.push({ id: rowIds[r], field: cols[c].key, value: get(src, c) });
    }
  }
  return changes;
}

export function buildClear(range: Range, rowIds: string[], cols: GridCol[], optionsFor: (r: number, c: number) => Opt[] | null | undefined): CellChange[] {
  const changes: CellChange[] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      if (!cols[c]?.editable) continue;
      const opts = optionsFor(r, c);
      if (opts && !opts.some((o) => o.value === "")) continue; // список без пустого значения не очищаем
      changes.push({ id: rowIds[r], field: cols[c].key, value: "" });
    }
  }
  return changes;
}
