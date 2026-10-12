import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { addIntermediary } from "../projects/actions";
import IntermediariesTable, { type IntermediaryRow } from "./IntermediariesTable";

type Search = Promise<{ error?: string }>;

export default async function IntermediariesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const rows = await fetchAll<IntermediaryRow>((from, to) =>
    supabase.from("intermediaries").select("domain, intermediary, price, updated_at").eq("team_id", team.id).order("domain").range(from, to),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-medium">База посередників</h1>
        <p className="mt-1 max-w-2xl text-mute">
          Спільна для всієї команди. Наповнюється кнопкою «Синхронізація» в модулі Communication, наступного разу контакти й ціни підтягнуться самі.
        </p>
      </div>

      {sp.error && <p className="note note-bad" role="alert">{sp.error}</p>}

      <form action={addIntermediary} className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label htmlFor="mb-domain" className="lbl">Донор</label>
          <input id="mb-domain" name="domain" className="inp" placeholder="site.com" required />
        </div>
        <div className="field">
          <label htmlFor="mb-med" className="lbl">Посередник</label>
          <input id="mb-med" name="intermediary" className="inp" placeholder="email або контакт" />
        </div>
        <div className="field">
          <label htmlFor="mb-price" className="lbl">Ціна</label>
          <input id="mb-price" name="price" className="inp w-28" />
        </div>
        <button type="submit" className="btn btn-pri">Додати</button>
      </form>

      <IntermediariesTable rows={rows} />
    </div>
  );
}
