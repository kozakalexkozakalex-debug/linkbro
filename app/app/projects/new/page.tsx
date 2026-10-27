import { redirect } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { createProject } from "../actions";
import { NICHES } from "@/lib/project";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";

type Search = Promise<{ error?: string }>;

export default async function NewProject({ searchParams }: { searchParams: Search }) {
  const { team } = await getTeamContext();
  if (team.role !== "lead") redirect("/app");
  const sp = await searchParams;
  const { t } = await getI18n();

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h1 className="page-title">{t("nav.newProject")}</h1>
        <p className="mt-1 text-mute">{t("proj.newLead")}</p>
      </div>
      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}
      <form action={createProject} className="card flex flex-col gap-4">
        <div className="field">
          <label htmlFor="name" className="lbl">{t("proj.name")}</label>
          <input id="name" name="name" className="inp" maxLength={100} required placeholder={t("proj.namePh")} />
        </div>
        <div className="field">
          <label htmlFor="niche" className="lbl">{t("common.niche")}</label>
          <input id="niche" name="niche" className="inp" list="niches" maxLength={60} placeholder={t("proj.nichePh")} />
          <datalist id="niches">
            {NICHES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="plan" className="lbl">{t("proj.plan")}</label>
          <input id="plan" name="plan" type="number" min={0} className="inp" defaultValue={10} />
        </div>
        <div>
          <button type="submit" className="btn btn-pri">{t("proj.create")}</button>
        </div>
      </form>
    </div>
  );
}
