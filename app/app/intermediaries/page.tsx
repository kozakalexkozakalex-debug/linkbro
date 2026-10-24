import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { addIntermediary } from "../projects/actions";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import IntermediariesTable, { type IntermediaryRow } from "./IntermediariesTable";

type Search = Promise<{ error?: string }>;

export default async function IntermediariesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const rows = await fetchAll<IntermediaryRow>((from, to) =>
    supabase.from("intermediaries").select("domain, intermediary, price, updated_at").eq("team_id", team.id).order("domain").range(from, to),
  );

  return (
    <div className="flex flex-col gap-5">
      <BaseTabs />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.intermediaries")}</h1>
        <p className="mt-1 max-w-2xl text-mute">
          {t("med.lead")}
        </p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{t(sp.error as MsgKey)}</p>}

      <form action={addIntermediary} className="card flex flex-wrap items-end gap-2">
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
      </form>

      <IntermediariesTable rows={rows} />
    </div>
  );
}
