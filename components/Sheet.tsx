"use client";

// Таблица «как в Google Sheets»:
// - клик / Shift+клик / протягивание мышью выделяют ячейки;
// - стрелки, Enter, Tab ходят по ячейкам, Enter/F2 или любая буква начинают правку, Esc отменяет;
// - Ctrl+C копирует выделение, Ctrl+V вставляет блок из Google Sheets / Excel;
// - квадратик в углу выделения тянется вниз и копирует значения;
// - Delete очищает ячейки; галочки слева + панель массовых действий.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buildClear, buildFill, buildPaste, norm, parseClipboard, toTsv, type CellChange, type GridCol, type Opt, type Range } from "@/lib/sheet";
import { useI18n } from "@/components/I18nProvider";

export type { CellChange, Opt };

export type SheetCol<T> = {
  key: string;
  header: string;
  width?: number;
  kind: "text" | "number" | "date" | "select" | "readonly";
  options?: Opt[] | ((row: T) => Opt[]);
  get?: (row: T) => string;
  render?: (row: T, v: (key: string) => string) => ReactNode;
  tone?: (value: string) => "ok" | "bad" | "warn" | "";
  placeholder?: string;
  mono?: boolean;
};

type Pos = { r: number; c: number };
const TONE = { ok: "pill-ok", bad: "pill-bad", warn: "pill-warn", "": "" } as const;

export default function Sheet<T extends { id: string }>({
  rows,
  columns,
  onSave,
  refreshAfterSave = true,
  bulk,
  empty,
}: {
  rows: T[];
  columns: SheetCol<T>[];
  onSave: (changes: CellChange[]) => Promise<{ ok: boolean; error?: string }>;
  refreshAfterSave?: boolean;
  bulk?: (ids: string[], clear: () => void) => ReactNode;
  empty?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();

  const initial = useCallback(
    (list: T[]) => {
      const out: Record<string, Record<string, string>> = {};
      for (const row of list) {
        const rec: Record<string, string> = {};
        for (const col of columns) {
          if (col.kind === "readonly" && !col.get) continue;
          const raw = col.get ? col.get(row) : (row as unknown as Record<string, unknown>)[col.key];
          rec[col.key] = raw == null ? "" : String(raw);
        }
        out[row.id] = rec;
      }
      return out;
    },
    [columns],
  );

  const [vals, setVals] = useState(() => initial(rows));
  useEffect(() => setVals(initial(rows)), [rows, initial]);

  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [focus, setFocus] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number; draft: string } | null>(null);
  const [fillTo, setFillTo] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const touchRef = useRef(false);
  const tapPrev = useRef<Pos | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const dragging = useRef(false);
  const filling = useRef(false);
  const fillToRef = useRef<number | null>(null);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const grid: GridCol[] = useMemo(() => columns.map((c) => ({ key: c.key, editable: c.kind !== "readonly" })), [columns]);
  const range: Range | null = anchor && focus ? norm(anchor, focus) : null;

  const optionsFor = useCallback(
    (r: number, c: number): Opt[] | null => {
      const col = columns[c];
      if (!col || col.kind !== "select" || !col.options) return null;
      return typeof col.options === "function" ? col.options(rows[r]) : col.options;
    },
    [columns, rows],
  );

  const get = useCallback(
    (r: number, c: number) => {
      const col = columns[c];
      const id = ids[r];
      if (!col || !id) return "";
      return vals[id]?.[col.key] ?? "";
    },
    [columns, ids, vals],
  );

  const labelOf = (r: number, c: number) => {
    const v = get(r, c);
    const opts = optionsFor(r, c);
    return opts ? opts.find((o) => o.value === v)?.label ?? v : v;
  };

  // ---------- Сохранение ----------
  function commit(changes: CellChange[]) {
    const real = changes.filter((ch) => (vals[ch.id]?.[ch.field] ?? "") !== ch.value);
    if (real.length === 0) return;
    const before = vals;
    setVals((v) => {
      const next = { ...v };
      for (const ch of real) next[ch.id] = { ...next[ch.id], [ch.field]: ch.value };
      return next;
    });
    start(async () => {
      const res = await onSave(real);
      if (!res.ok) {
        setVals(before);
        setMsg({ text: res.error ?? t("sheet.saveFailed"), bad: true });
      } else {
        if (real.length > 1) setMsg({ text: t("sheet.saved", { n: real.length }) });
        if (refreshAfterSave) router.refresh();
      }
    });
  }

  // ---------- Выделение мышью ----------
  function onCellDown(e: React.MouseEvent, r: number, c: number) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label")) return;
    e.preventDefault();
    if (editing) finishEdit(true);
    if (e.shiftKey && anchor) setFocus({ r, c });
    else {
      setAnchor({ r, c });
      setFocus({ r, c });
    }
    dragging.current = true;
    wrap.current?.focus({ preventScroll: true });
  }
  function onCellEnter(r: number, c: number) {
    if (dragging.current) setFocus({ r, c });
    if (filling.current && range) {
      const to = Math.max(r, range.r1);
      fillToRef.current = to;
      setFillTo(to);
    }
  }
  useEffect(() => {
    function up() {
      dragging.current = false;
      if (filling.current) {
        filling.current = false;
        const to = fillToRef.current;
        fillToRef.current = null;
        setFillTo(null);
        if (to != null && range && to > range.r1) commit(buildFill(range, to, ids, grid, get));
      }
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  });

  // ---------- Правка ----------
  function startEdit(r: number, c: number, draft?: string) {
    if (!grid[c]?.editable) return;
    setEditing({ r, c, draft: draft ?? get(r, c) });
  }
  function finishEdit(save: boolean, move?: "down" | "right") {
    if (!editing) return;
    const { r, c, draft } = editing;
    setEditing(null);
    if (save) {
      const val = columns[c].kind === "select" ? draft : draft.trim();
      commit([{ id: ids[r], field: columns[c].key, value: val }]);
    }
    if (move) {
      const next = move === "down" ? { r: Math.min(r + 1, ids.length - 1), c } : { r, c: Math.min(c + 1, columns.length - 1) };
      setAnchor(next);
      setFocus(next);
    }
    requestAnimationFrame(() => wrap.current?.focus({ preventScroll: true }));
  }

  // ---------- Клавиатура ----------
  function onKeyDown(e: React.KeyboardEvent) {
    if (editing || !focus) return;
    const max = { r: ids.length - 1, c: columns.length - 1 };
    const moveTo = (p: Pos, extend: boolean) => {
      const q = { r: Math.max(0, Math.min(max.r, p.r)), c: Math.max(0, Math.min(max.c, p.c)) };
      setFocus(q);
      if (!extend) setAnchor(q);
      document.getElementById(`sh-${ids[q.r]}-${q.c}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const k = e.key;
    if (k === "ArrowDown") moveTo({ r: focus.r + 1, c: focus.c }, e.shiftKey);
    else if (k === "ArrowUp") moveTo({ r: focus.r - 1, c: focus.c }, e.shiftKey);
    else if (k === "ArrowRight") moveTo({ r: focus.r, c: focus.c + 1 }, e.shiftKey);
    else if (k === "ArrowLeft") moveTo({ r: focus.r, c: focus.c - 1 }, e.shiftKey);
    else if (k === "Tab") moveTo({ r: focus.r, c: focus.c + (e.shiftKey ? -1 : 1) }, false);
    else if (k === "Enter" || k === "F2") startEdit(focus.r, focus.c);
    else if ((k === "Delete" || k === "Backspace") && range) commit(buildClear(range, ids, grid, optionsFor));
    else if (k === "Escape") {
      setAnchor(null);
      setFocus(null);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && columns[focus.c]?.kind !== "select") {
      startEdit(focus.r, focus.c, k);
    } else return;
    e.preventDefault();
  }

  function onCopy(e: React.ClipboardEvent) {
    if (editing || !range) return;
    const out: string[][] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const line: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) line.push(columns[c].kind === "readonly" && !columns[c].get ? "" : labelOf(r, c));
      out.push(line);
    }
    e.clipboardData.setData("text/plain", toTsv(out));
    e.preventDefault();
  }

  function onPaste(e: React.ClipboardEvent) {
    if (editing || !range) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const { changes, skipped } = buildPaste(parseClipboard(text), range, ids, grid, optionsFor);
    if (skipped) setMsg({ text: t("sheet.skipped", { n: skipped }), bad: true });
    commit(changes);
  }

  // ---------- Галочки ----------
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clear = () => setChecked(new Set());
  useEffect(() => {
    setChecked((s) => new Set([...s].filter((id) => ids.includes(id))));
  }, [ids]);

  if (rows.length === 0) return <>{empty ?? <div className="card text-center text-mute">{t("common.noData")}</div>}</>;

  const fillRange = range && fillTo != null && fillTo > range.r1 ? { r0: range.r1 + 1, r1: fillTo, c0: range.c0, c1: range.c1 } : null;

  return (
    <div className="flex flex-col gap-2">
      {bulk && checked.size > 0 && (
        <div className="bulk-bar">
          <b>{t("sheet.selected", { n: checked.size })}</b>
          {bulk([...checked], clear)}
          <button type="button" className="btn btn-sm" onClick={clear}>{t("sheet.clearSel")}</button>
        </div>
      )}
      {msg && (
        <p className={`note ${msg.bad ? "note-bad" : "note-ok"} flex items-center justify-between gap-2`} role="status">
          <span>{msg.text}</span>
          <button type="button" className="text-xs underline" onClick={() => setMsg(null)}>{t("common.hide")}</button>
        </p>
      )}
      <div
        ref={wrap}
        tabIndex={0}
        className={`tbl-wrap sheet ${bulk ? "sheet-bulk" : ""} ${pending ? "sheet-saving" : ""}`}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        aria-label={t("sheet.aria")}
      >
        <table className="tbl">
          <thead>
            <tr>
              {bulk && (
                <th className="sh-check">
                  <input
                    type="checkbox"
                    aria-label={t("sheet.selectAll")}
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(ids))}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={c === columns[0] ? "sh-first" : undefined} style={{ minWidth: c.width }}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id} className={checked.has(row.id) ? "sh-row-checked" : undefined}>
                {bulk && (
                  <td className="sh-check">
                    <input type="checkbox" aria-label={t("sheet.selectRow")} checked={checked.has(row.id)} onChange={() => toggle(row.id)} />
                  </td>
                )}
                {columns.map((col, c) => {
                  const inRange = range && r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
                  const isFocus = focus && focus.r === r && focus.c === c;
                  const inFill = fillRange && r >= fillRange.r0 && r <= fillRange.r1 && c >= fillRange.c0 && c <= fillRange.c1;
                  const isEdit = editing && editing.r === r && editing.c === c;
                  const corner = range && !editing && r === range.r1 && c === range.c1 && grid[c].editable;
                  const v = (key: string) => vals[row.id]?.[key] ?? "";
                  const opts = optionsFor(r, c);
                  const value = v(col.key);
                  const cls = [
                    "sh-cell",
                    c === 0 ? "sh-first" : "",
                    col.kind !== "readonly" ? "sh-edit" : "",
                    inRange ? "sh-sel" : "",
                    isFocus ? "sh-focus" : "",
                    inFill ? "sh-fill" : "",
                    col.mono ? "font-mono" : "",
                  ].join(" ");

                  return (
                    <td
                      key={col.key}
                      id={`sh-${row.id}-${c}`}
                      className={cls}
                      style={{ minWidth: col.width, maxWidth: col.width ? col.width * 1.6 : undefined }}
                      onMouseDown={(e) => onCellDown(e, r, c)}
                      onMouseEnter={() => onCellEnter(r, c)}
                      onDoubleClick={() => startEdit(r, c)}
                      onTouchStart={() => {
                        touchRef.current = true;
                        tapPrev.current = focus;
                      }}
                      onClick={() => {
                        // Телефон: первое касание выбирает клетку, второе — открывает правку
                        if (!touchRef.current) return;
                        touchRef.current = false;
                        const p = tapPrev.current;
                        if (!editing && p && p.r === r && p.c === c) startEdit(r, c);
                      }}
                    >
                      {isEdit && editing ? (
                        col.kind === "select" ? (
                          <select
                            autoFocus
                            className="sh-input"
                            aria-label={col.header}
                            value={editing.draft}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditing(null);
                              commit([{ id: row.id, field: col.key, value: val }]);
                              requestAnimationFrame(() => wrap.current?.focus({ preventScroll: true }));
                            }}
                            onBlur={() => finishEdit(false)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") finishEdit(false);
                            }}
                          >
                            {(opts ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            className="sh-input"
                            aria-label={col.header}
                            type={col.kind === "date" ? "date" : "text"}
                            inputMode={col.kind === "number" ? "decimal" : undefined}
                            value={editing.draft}
                            onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                            onBlur={() => finishEdit(true)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                finishEdit(true, "down");
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                finishEdit(true, "right");
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                finishEdit(false);
                              }
                            }}
                          />
                        )
                      ) : col.render ? (
                        col.render(row, v)
                      ) : col.kind === "select" ? (
                        value ? (
                          <span className={`pill ${TONE[col.tone?.(value) ?? ""]}`}>{opts?.find((o) => o.value === value)?.label ?? value}</span>
                        ) : (
                          <span className="text-mute">—</span>
                        )
                      ) : value ? (
                        <span className="sh-text" title={value.length > 24 ? value : undefined}>{value}</span>
                      ) : (
                        <span className="sh-ph">{col.placeholder ?? ""}</span>
                      )}
                      {corner && (
                        <span
                          className="sh-handle"
                          title={t("sheet.fill")}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            filling.current = true;
                            fillToRef.current = range ? range.r1 : null;
                            setFillTo(fillToRef.current);
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sheet-help text-xs text-mute">{t("sheet.help")}</p>
      <p className="sheet-touch-help text-xs text-mute">{t("sheet.touchHelp")}</p>
    </div>
  );
}
