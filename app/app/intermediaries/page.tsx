import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { addIntermediary } from "../projects/actions";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import IntermediariesTable, { type IntermediaryRow } from "./IntermediariesTable";
import PeopleTable, { type PersonRow } from "./PeopleTable";
import Link from "next/link";

type Search = Promise<{ error?: string; v?: string }>;

export default async function IntermediariesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const sites = sp.v === "sites";
  // Все запросы параллельно: сайты посредников, карточки контактов, сделки, последняя переписка
  const [rows, contacts, deals, { data: acts }] = await Promise.all([
    fetchAll<IntermediaryRow>((from, to) =>
      supabase.from("intermediaries").select("domain, intermediary, price, updated_at").eq("team_id", team.id).order("domain").range(from, to),
    ),
    fetchAll<{ handle: string; kind: string; name: string; email: string; telegram: string; whatsapp: string }>((from, to) =>
      supabase.from("contacts").select("handle, kind, name, email, telegram, whatsapp").eq("team_id", team.id).order("handle").range(from, to),
    ),
    fetchAll<{ med_base: string; stage: string }>((from, to) =>
      supabase.from("project_donors").select("med_base, stage").eq("team_id", team.id).neq("med_base", "").order("id").range(from, to),
    ),
    supabase.from("activities").select("handle, direction, created_at").eq("team_id", team.id).neq("handle", "").neq("channel", "note").order("created_at", { ascending: false }).limit(3000),
  ]);
  const people = new Map<string, PersonRow>();
  const get = (h: string) => {
    const k = h.trim();
    if (!people.has(k)) people.set(k, { handle: k, kind: "intermediary", name: "", email: /@/.test(k) && !k.startsWith("@") ? k : "", telegram: k.startsWith("@") ? k : "", whatsapp: "", sites: 0, deals: 0, live: 0, published: 0, last: null, replies: 0 });
    return people.get(k)!;
  };
  for (const c of contacts) Object.assign(get(c.handle), { kind: c.kind, name: c.name, email: c.email || get(c.handle).email, telegram: c.telegram || get(c.handle).telegram, whatsapp: c.whatsapp });
  for (const r of rows) if (r.intermediary.trim()) get(r.intermediary).sites++;
  for (const d of deals) {
    const p = get(d.med_base);
    p.deals++;
    if (d.stage === "published") p.published++;
    else if (d.stage !== "lost") p.live++;
  }
  for (const a of (acts ?? []) as { handle: string; direction: string; created_at: string }[]) {
    const p = people.get(a.handle.trim());
    if (!p) continue;
    if (!p.last) p.last = a.created_at;
    if (a.direction === "in") p.replies++;
  }
  const list = [...people.values()].filter((p) => p.handle).sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "") || b.deals - a.deals);

  return (
    <div className="flex flex-col gap-5">
      <BaseTabs />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.intermediaries")}</h1>
        <div className="seg">
          <Link href="/app/intermediaries" className={sites ? "" : "seg-on"}>{t("ot.people", { n: list.length })}</Link>
          <Link href="/app/intermediaries?v=sites" className={sites ? "seg-on" : ""}>{t("ot.sitesPrices", { n: rows.length })}</Link>
        </div>
      </div>
      <div>
        <p className="mt-1 max-w-2xl text-mute">
          {t("med.lead")}
        </p>
      </div>

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
