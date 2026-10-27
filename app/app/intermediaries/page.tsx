import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { loadPeople } from "@/lib/people";
import Icon from "@/components/Icon";
import { addIntermediary } from "../projects/actions";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import IntermediariesTable from "./IntermediariesTable";
import PeopleTable from "./PeopleTable";
import Link from "next/link";

type Search = Promise<{ error?: string; v?: string }>;

export default async function IntermediariesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const sites = sp.v === "sites";
  const { people: list, sites: rows } = await loadPeople(supabase, team.id);

  return (
    <div className="flex flex-col gap-5">
      <BaseTabs />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="page-title flex items-center gap-2"><Icon name="users" size={18} className="text-accent" />Nexo</h1>
          <p className="text-sm text-mute">{t("nexo.sub")}</p>
        </div>
        <div className="seg">
          <Link href="/app/intermediaries" className={sites ? "" : "seg-on"}>{t("ot.people", { n: list.length })}</Link>
          <Link href="/app/intermediaries?v=sites" className={sites ? "seg-on" : ""}>{t("ot.sitesPrices", { n: rows.length })}</Link>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-mute">{t("med.lead")}</p>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}

      {!sites && <PeopleTable rows={list} />}

      {sites && <form action={addIntermediary} className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label htmlFor="mb-domain" className="lbl">{t("med.donor")}</label>
          <input id="mb-domain" name="domain" className="inp" placeholder="site.com" required />
        </div>
        <div className="field">
          <label htmlFor="mb-med" className="lbl">{t("med.intermediary")}</label>
          <input id="mb-med" name="intermediary" className="inp" placeholder={t("med.contactPh")} />
        </div>
        <div className="field">
          <label htmlFor="mb-price" className="lbl">{t("common.price")}</label>
          <input id="mb-price" name="price" className="inp w-28" />
        </div>
        <button type="submit" className="btn btn-pri">{t("common.add")}</button>
      </form>}

      {sites && <IntermediariesTable rows={rows} />}
    </div>
  );
}
