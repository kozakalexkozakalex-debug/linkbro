import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { loadPeople } from "@/lib/people";
import Icon from "@/components/Icon";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import IntermediariesTable from "./IntermediariesTable";
import PeopleTable from "./PeopleTable";
import NexoAdd from "./NexoAdd";
import Link from "next/link";

type Search = Promise<{ error?: string; v?: string }>;

export default async function IntermediariesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  // По умолчанию — «Сайти й ціни» (посередник · домен · ціна · коли оновлена ціна); «Люди» — список контактів
  const peopleView = sp.v === "people";
  const { people: list, sites: rows } = await loadPeople(supabase, team.id);

  return (
    <div className="flex flex-col gap-4">
      <BaseTabs />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="page-title flex items-center gap-2"><Icon name="users" size={18} className="text-accent" />Nexo</h1>
          <p className="text-sm text-mute">{t("nexo.sub")}</p>
        </div>
        <div className="seg">
          <Link href="/app/intermediaries" className={peopleView ? "" : "seg-on"}>{t("ot.sitesPrices", { n: rows.length })}</Link>
          <Link href="/app/intermediaries?v=people" className={peopleView ? "seg-on" : ""}>{t("ot.people", { n: list.length })}</Link>
        </div>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}

      <NexoAdd handles={list.map((p) => p.handle)} />

      {peopleView ? <PeopleTable rows={list} /> : <IntermediariesTable rows={rows} />}
    </div>
  );
}
