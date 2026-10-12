"use client";

import { useState, useTransition } from "react";
import { saveProjectFilter, saveStoplist, updateProject } from "../actions";
import { METRICS, type MetricFilter } from "@/lib/global";

type P = { id: string; name: string; plan_per_month: number; requirements: string; notes: string; filter: MetricFilter };

export default function Profile({
  project,
  isLead,
  stopTools,
  stopGlobalCount,
}: {
  project: P;
  isLead: boolean;
  stopTools: string[];
  stopGlobalCount: number;
}) {
  const [filter, setFilter] = useState(project.filter);
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function saveFilter() {
    start(async () => {
      const r = await saveProjectFilter(project.id, filter);
      setFilterMsg(r.ok ? "Фільтр збережено." : r.error);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={updateProject} className="card flex flex-col gap-4">
        <p className="lbl">Профіль проєкту</p>
        <input type="hidden" name="id" value={project.id} />
        <div className="field">
          <label htmlFor="p-name" className="lbl">Назва</label>
          <input id="p-name" name="name" className="inp" defaultValue={project.name} disabled={!isLead} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="p-plan" className="lbl">План публікацій на місяць</label>
          <input id="p-plan" name="plan" type="number" min={0} className="inp" defaultValue={project.plan_per_month} disabled={!isLead} />
        </div>
        <div className="field">
          <label htmlFor="p-req" className="lbl">Вимоги до проєкту</label>
          <textarea id="p-req" name="requirements" className="inp min-h-28" defaultValue={project.requirements} disabled={!isLead}
            placeholder="Тематика, GEO, dofollow, заборонені сайти…" />
        </div>
        <div className="field">
          <label htmlFor="p-notes" className="lbl">Нотатки</label>
          <textarea id="p-notes" name="notes" className="inp min-h-28" defaultValue={project.notes} disabled={!isLead} />
        </div>
        {isLead && <div><button type="submit" className="btn btn-pri">Зберегти</button></div>}
      </form>

      <div className="card flex flex-col gap-4">
        <div>
          <p className="lbl">Фільтр проєкту</p>
          <p className="mt-1 text-sm text-mute">
            Застосовується, коли донори FIT передаються з глобальної бази. Порожнє поле означає «без обмеження».
          </p>
        </div>
        <div className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
          <span />
          <span className="lbl">Min</span>
          <span className="lbl">Max</span>
          {METRICS.map((m) => (
            <div key={m.key} className="contents">
              <b className="text-sm">{m.label}</b>
              {(["min", "max"] as const).map((edge) => (
                <input
                  key={edge}
                  id={`pf-${m.key}-${edge}`}
                  aria-label={`${m.label} ${edge}`}
                  inputMode="decimal"
                  className="inp"
                  disabled={!isLead}
                  value={filter[m.key][edge]}
                  onChange={(e) => setFilter({ ...filter, [m.key]: { ...filter[m.key], [edge]: e.target.value } })}
                />
              ))}
            </div>
          ))}
        </div>
        {isLead && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-pri" onClick={saveFilter} disabled={pending}>Зберегти фільтр</button>
            {filterMsg && <span className="text-sm text-mute">{filterMsg}</span>}
          </div>
        )}
      </div>

      <form action={saveStoplist} className="card flex flex-col gap-3">
        <input type="hidden" name="project_id" value={project.id} />
        <input type="hidden" name="source" value="tools" />
        <div>
          <p className="lbl">Стоп-лист (інструменти) · {stopTools.length}</p>
          <p className="mt-1 text-sm text-mute">
            Домени, де лінк уже є: оновлюйте щомісяця з Ahrefs / GSC / Majestic. Один домен на рядок, список замінюється повністю.
          </p>
        </div>
        <textarea
          id="stop-tools"
          name="domains"
          aria-label="Стоп-лист (інструменти)"
          className="inp min-h-40 font-mono text-sm"
          defaultValue={stopTools.join("\n")}
          disabled={!isLead}
        />
        {isLead && <div><button type="submit" className="btn">Зберегти стоп-лист</button></div>}
      </form>

      <div className="card flex flex-col gap-2">
        <p className="lbl">Стоп-лист (Глобал) · {stopGlobalCount}</p>
        <p className="text-sm text-mute">
          Наповнюється автоматично: усе, що вже приходило з глобальної бази. Ці домени не потраплять у проєкт повторно.
        </p>
      </div>
    </div>
  );
}
