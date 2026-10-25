"use client";

import { useState, useTransition } from "react";
import { createReportLink, revokeReportLink, saveProjectFilter, saveStoplist, setReportPrices, updateProject } from "../actions";
import CopyButton from "@/components/CopyButton";
import { METRICS, type MetricFilter } from "@/lib/global";
import { NICHES } from "@/lib/project";
import { CURRENCIES } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";

type P = {
  id: string;
  name: string;
  niche: string;
  client_site: string;
  geo: string;
  language: string;
  monthly_budget: number | null;
  link_budget?: number | null;
  budget_currency: string;
  plan_per_month: number; requirements: string; notes: string; filter: MetricFilter };

export default function Profile({
  project,
  isLead,
  stopTools,
  stopGlobal,
  stopGlobalCount,
  reportUrl,
  reportPrices,
}: {
  project: P;
  isLead: boolean;
  stopTools: string[];
  stopGlobal: string[];
  stopGlobalCount: number;
  reportUrl: string | null;
  reportPrices: boolean;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState(project.filter);
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function saveFilter() {
    start(async () => {
      const r = await saveProjectFilter(project.id, filter);
      setFilterMsg(r.ok ? t("prof.filterSaved") : r.error);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={updateProject} className="card flex flex-col gap-4">
        <p className="lbl">{t("prof.title")}</p>
        <input type="hidden" name="id" value={project.id} />
        <div className="field">
          <label htmlFor="p-name" className="lbl">{t("proj.name")}</label>
          <input id="p-name" name="name" className="inp" defaultValue={project.name} disabled={!isLead} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="p-niche" className="lbl">{t("common.niche")}</label>
          <input id="p-niche" name="niche" className="inp" list="p-niches" defaultValue={project.niche} disabled={!isLead} maxLength={60}
            placeholder={t("proj.nichePh")} />
          <datalist id="p-niches">
            {NICHES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="p-site" className="lbl">{t("prof.site")}</label>
          <input id="p-site" name="client_site" className="inp" defaultValue={project.client_site} disabled={!isLead} maxLength={300} placeholder="client.com" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="p-geo" className="lbl">GEO</label>
            <input id="p-geo" name="geo" className="inp" defaultValue={project.geo} disabled={!isLead} maxLength={100} placeholder="UA, PL, US" />
          </div>
          <div className="field">
            <label htmlFor="p-lang" className="lbl">{t("prof.language")}</label>
            <input id="p-lang" name="language" className="inp" defaultValue={project.language} disabled={!isLead} maxLength={60} placeholder={t("prof.languagePh")} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_110px]">
          <div className="field">
            <label htmlFor="p-plan" className="lbl">{t("proj.plan")}</label>
            <input id="p-plan" name="plan" type="number" min={0} className="inp" defaultValue={project.plan_per_month} disabled={!isLead} />
          </div>
          <div className="field">
            <label htmlFor="p-budget" className="lbl">{t("prof.budget")}</label>
            <input id="p-budget" name="monthly_budget" inputMode="decimal" className="inp" defaultValue={project.monthly_budget ?? ""} disabled={!isLead} placeholder={t("prof.noLimit")} />
          </div>
          <div className="field">
            <label htmlFor="p-link" className="lbl">{t("pr.linkBudget")}</label>
            <input id="p-link" name="link_budget" inputMode="decimal" className="inp" defaultValue={project.link_budget ?? ""} disabled={!isLead} placeholder={t("prof.noLimit")} />
          </div>
          <div className="field">
            <label htmlFor="p-cur" className="lbl">{t("common.currency")}</label>
            <select id="p-cur" name="budget_currency" className="inp" defaultValue={project.budget_currency || "USD"} disabled={!isLead}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="p-req" className="lbl">{t("prof.requirements")}</label>
          <textarea id="p-req" name="requirements" className="inp min-h-28" defaultValue={project.requirements} disabled={!isLead}
            placeholder={t("prof.requirementsPh")} />
        </div>
        <div className="field">
          <label htmlFor="p-notes" className="lbl">{t("prof.notes")}</label>
          <textarea id="p-notes" name="notes" className="inp min-h-28" defaultValue={project.notes} disabled={!isLead} />
        </div>
        {isLead && <div><button type="submit" className="btn btn-pri">{t("common.save")}</button></div>}
      </form>

      <div className="card flex flex-col gap-4">
        <div>
          <p className="lbl">{t("prof.filter")}</p>
          <p className="mt-1 text-sm text-mute">
            {t("prof.filterHint")}
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
            <button type="button" className="btn btn-pri" onClick={saveFilter} disabled={pending}>{t("prof.saveFilter")}</button>
            {filterMsg && <span className="text-sm text-mute">{filterMsg}</span>}
          </div>
        )}
      </div>

      <form action={saveStoplist} className="card flex flex-col gap-3">
        <input type="hidden" name="project_id" value={project.id} />
        <input type="hidden" name="source" value="tools" />
        <div>
          <p className="lbl">{t("prof.stopTools")} · {stopTools.length}</p>
          <p className="mt-1 text-sm text-mute">
            {t("prof.stopToolsHint")}
          </p>
        </div>
        <textarea
          id="stop-tools"
          name="domains"
          aria-label={t("prof.stopTools")}
          className="inp min-h-40 font-mono text-sm"
          defaultValue={stopTools.join("\n")}
          disabled={!isLead}
        />
        {isLead && <div><button type="submit" className="btn">{t("prof.saveStoplist")}</button></div>}
      </form>

      <div className="card flex flex-col gap-3 lg:col-span-2">
        <div>
          <p className="lbl">{t("prof.report")}</p>
          <p className="mt-1 text-sm text-mute">
            {t("prof.reportHint")}
          </p>
        </div>
        {reportUrl ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input id="report-url" aria-label={t("prof.reportLink")} readOnly value={reportUrl} className="inp min-w-0 flex-1 font-mono text-xs" />
              <CopyButton text={reportUrl} />
              <a href={reportUrl} target="_blank" rel="noreferrer" className="btn btn-sm">{t("common.open")}</a>
            </div>
            {isLead && (
              <div className="flex flex-wrap gap-2">
                <form action={setReportPrices}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="show" value={reportPrices ? "0" : "1"} />
                  <button type="submit" className="btn btn-sm">{reportPrices ? t("prof.hidePrices") : t("prof.showPrices")}</button>
                </form>
                <form action={revokeReportLink}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <button type="submit" className="btn btn-sm">{t("prof.revoke")}</button>
                </form>
              </div>
            )}
          </>
        ) : isLead ? (
          <form action={createReportLink}>
            <input type="hidden" name="project_id" value={project.id} />
            <button type="submit" className="btn btn-pri">{t("prof.createReport")}</button>
          </form>
        ) : (
          <p className="text-sm text-mute">{t("prof.noReport")}</p>
        )}
      </div>

      <div className="card flex flex-col gap-2">
        <p className="lbl">{t("prof.stopGlobal")} · {stopGlobalCount}</p>
        <p className="text-sm text-mute">
          {t("prof.stopGlobalHint")}
        </p>
        <textarea
          id="stop-global"
          aria-label={t("prof.stopGlobal")}
          readOnly
          className="inp min-h-32 font-mono text-sm"
          value={stopGlobal.length ? stopGlobal.join("\n") : t("prof.emptyYet")}
        />
      </div>
    </div>
  );
}
