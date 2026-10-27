// Nexo — база посередників: люди (контакти) з сайтами, угодами й останньою перепискою.
// Один збирач для сторінки Nexo і для панелі, що виїжджає справа в Outreach.
import { fetchAll } from "@/lib/fetchAll";
import type { PersonRow } from "@/app/app/intermediaries/PeopleTable";
import type { IntermediaryRow } from "@/app/app/intermediaries/IntermediariesTable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function loadPeople(supabase: Db, teamId: string): Promise<{ people: PersonRow[]; sites: IntermediaryRow[] }> {
  // Все запросы параллельно: сайты посредников, карточки контактов, сделки, последняя переписка
  const [rows, contacts, deals, { data: acts }] = await Promise.all([
    fetchAll<IntermediaryRow>((from, to) =>
      supabase.from("intermediaries").select("domain, intermediary, price, updated_at").eq("team_id", teamId).order("domain").range(from, to),
    ),
    fetchAll<{ handle: string; kind: string; name: string; email: string; telegram: string; whatsapp: string; do_not_contact: boolean }>((from, to) =>
      supabase.from("contacts").select("handle, kind, name, email, telegram, whatsapp, do_not_contact").eq("team_id", teamId).order("handle").range(from, to),
    ),
    fetchAll<{ med_base: string; stage: string }>((from, to) =>
      supabase.from("project_donors").select("med_base, stage").eq("team_id", teamId).neq("med_base", "").order("id").range(from, to),
    ),
    supabase.from("activities").select("handle, direction, created_at").eq("team_id", teamId).neq("handle", "").neq("channel", "note").order("created_at", { ascending: false }).limit(3000),
  ]);
  const people = new Map<string, PersonRow>();
  const get = (h: string) => {
    const k = h.trim();
    if (!people.has(k)) people.set(k, { handle: k, kind: "intermediary", name: "", email: /@/.test(k) && !k.startsWith("@") ? k : "", telegram: k.startsWith("@") ? k : "", whatsapp: "", dnc: false, sites: 0, deals: 0, live: 0, published: 0, last: null, replies: 0 });
    return people.get(k)!;
  };
  for (const c of contacts) Object.assign(get(c.handle), { kind: c.kind, name: c.name, email: c.email || get(c.handle).email, telegram: c.telegram || get(c.handle).telegram, whatsapp: c.whatsapp, dnc: !!c.do_not_contact });
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
  return { people: list, sites: rows };
}
