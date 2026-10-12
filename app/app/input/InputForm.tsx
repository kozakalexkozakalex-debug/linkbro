"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addToGlobal, type InputResult } from "../global/actions";

export default function InputForm() {
  const [result, action, pending] = useActionState<InputResult, FormData>(addToGlobal, null);

  return (
    <>
      <form action={action} className="card flex flex-col gap-4">
        <div className="field">
          <label htmlFor="raw" className="lbl">Domain / Price</label>
          <textarea
            id="raw"
            name="raw"
            className="inp min-h-48 font-mono text-sm"
            placeholder={"site-one.com 1500\nhttps://www.site-two.com/blog 80\nsite-three.com"}
            required
          />
        </div>
        <div className="field max-w-xs">
          <label htmlFor="prefix" className="lbl">Префікс ціни (звідки ціна)</label>
          <input id="prefix" name="prefix" className="inp" placeholder="Наприклад, PRnews" maxLength={40} />
          <span className="text-xs text-mute">Ціна збережеться як «PRnews 1500». Можна лишити порожнім.</span>
        </div>
        <div>
          <button type="submit" className="btn btn-pri" disabled={pending}>
            {pending ? "Передаю…" : "Передати у глобал"}
          </button>
        </div>
      </form>

      {result?.error && <p className="note note-bad" role="alert">{result.error}</p>}

      {result && !result.error && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card">
            <p className="lbl mb-2">Додано: {result.added.length}</p>
            <ul className="font-mono text-sm">
              {result.added.map((d) => <li key={d}>{d}</li>)}
            </ul>
            {result.added.length > 0 && (
              <Link href="/app/global" className="btn btn-sm mt-3">Відкрити глобальну базу</Link>
            )}
          </div>
          <div className="card">
            <p className="lbl mb-2">Вже були в базі: {result.dup.length}</p>
            <ul className="font-mono text-sm text-mute">
              {result.dup.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        </div>
      )}

      {result && result.invalid.length > 0 && (
        <div className="card">
          <p className="lbl mb-2">Не схоже на домен, пропущено: {result.invalid.length}</p>
          <ul className="font-mono text-sm text-bad">
            {result.invalid.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
