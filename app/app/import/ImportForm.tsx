"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { importGlobal, type ImportResult, type ImportRow } from "../global/actions";
import { IMPORT_FIELDS, guessMapping, parseCsv, type ImportKey } from "@/lib/csv";

export default function ImportForm() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Partial<Record<ImportKey, number>>>({});
  const [prefix, setPrefix] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const header = hasHeader ? rows[0] ?? [] : (rows[0] ?? []).map((_, i) => `Колонка ${i + 1}`);
  const body = hasHeader ? rows.slice(1) : rows;
  const columns = header.map((h, i) => ({ i, label: h || `Колонка ${i + 1}` }));

  function onFile(file: File | undefined) {
    setResult(null);
    setReadError(null);
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length === 0) {
        setReadError("Файл порожній або це не CSV.");
        return;
      }
      setRows(parsed);
      setMapping(guessMapping(parsed[0]));
    };
    reader.onerror = () => setReadError("Не вдалося прочитати файл.");
    reader.readAsText(file, "utf-8");
  }

  function build(): ImportRow[] {
    return body.map((r) => {
      const o: ImportRow = {};
      for (const f of IMPORT_FIELDS) {
        const idx = mapping[f.key];
        if (idx != null) o[f.key] = r[idx] ?? "";
      }
      return o;
    });
  }

  function run() {
    const mapped = Object.keys(mapping).filter((k) => mapping[k as ImportKey] != null);
    start(async () => {
      const r = await importGlobal(build(), { prefix, updateExisting, mapped });
      setResult(r);
    });
  }

  const preview = build().slice(0, 5);

  return (
    <>
      <div className="card flex flex-col gap-3">
        <div className="field">
          <label htmlFor="csv-file" className="lbl">Файл CSV</label>
          <input id="csv-file" type="file" accept=".csv,.txt,text/csv" className="text-sm" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {fileName && rows.length > 0 && (
          <p className="text-sm text-mute">
            {fileName}: рядків {body.length}
            {body.length > 5000 && <span className="text-bad"> · за раз можна до 5000, розділіть файл</span>}
          </p>
        )}
        {readError && <p className="note note-bad">{readError}</p>}
      </div>

      {rows.length > 0 && (
        <div className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <p className="lbl">Яка колонка що означає</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Перший рядок — заголовки
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="field">
                <label htmlFor={`map-${f.key}`} className="lbl">{f.label}</label>
                <select
                  id={`map-${f.key}`}
                  className="inp"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                >
                  <option value="">— не імпортувати —</option>
                  {columns.map((c) => <option key={c.i} value={c.i}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="imp-prefix" className="lbl">Префікс ціни (звідки ціна)</label>
              <input id="imp-prefix" className="inp" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Наприклад, Collaborator" />
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              Оновити метрики в доменах, які вже є в базі
            </label>
          </div>

          {preview.length > 0 && (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>{IMPORT_FIELDS.filter((f) => mapping[f.key] != null).map((f) => <th key={f.key}>{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      {IMPORT_FIELDS.filter((f) => mapping[f.key] != null).map((f) => (
                        <td key={f.key} className="max-w-48 truncate">{r[f.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <button
              type="button"
              className="btn btn-pri"
              disabled={pending || mapping.domain == null || body.length === 0 || body.length > 5000}
              onClick={run}
            >
              {pending ? "Імпортую…" : `Імпортувати ${body.length} рядків`}
            </button>
            {mapping.domain == null && <span className="ml-2 text-sm text-bad">Оберіть колонку з доменом</span>}
          </div>
        </div>
      )}

      {result && (
        <div className={`note ${result.error ? "note-bad" : "note-ok"}`} role="status">
          {result.error ? (
            result.error
          ) : (
            <>
              Додано: {result.added} · оновлено: {result.updated} · уже були в базі: {result.duplicates} · не схоже на домен: {result.invalid}.{" "}
              <Link href="/app/global" className="underline">Відкрити Глобальну базу</Link>
            </>
          )}
        </div>
      )}
    </>
  );
}
