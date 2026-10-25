import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { getI18n } from "@/lib/i18n/server";
import { fmtAmount, fmtMoney, addTo, realCost, payState, type ByCurrency } from "@/lib/money";
import { CORE_NEG } from "@/lib/project";
import ContactEditor from "./ContactEditor";
import ContactThread, { type ThreadDeal, type ThreadItem } from "./ContactThread";
import { stageOf, STAGE_KEY } from "@/lib/stages";
import { emailOf } from "@/lib/outreach";
import type { Contact } from "../../projects/deal-actions";

// Контакт (посредник): вся переписка по всем сделкам, написать письмо, его сайты, цены и история работы.
type Search = Promise<{ c?: string }>;
type Row = {
  id: string;
  project_id: string;
  domain: string;
  stage: string | null;
  core_status: string;
  indicator: string | null;
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
  anchors: string;
  page_url: string;
  article_deadline: string | null;
};

export default async function MedProfile({ searchParams }: { searchParams: Search }) {
  const contact = ((await searchParams).c ?? "").trim();
  const { supabase, team } = await getTeamContext();
  const { t, intl } = await getI18n();

  // Всё параллельно: сайты посредника, сделки, проекты, карточка, переписка, шаблоны, ящик
  const [sites, work, { data: pData }, { data: cData }, { data: aData }, { data: tData }, { data: mData }] = await Promise.all([
    fetchAll<{ domain: string; price: string }>((from, to) =>
      supabase.from("intermediaries").select("domain, price").eq("team_id", team.id).eq("intermediary", contact).order("domain").range(from, to),
    ),
    fetchAll<Row>((from, to) =>
      supabase
        .from("project_donors")
        .select("id, project_id, domain, stage, core_status, indicator, gp_price, gp_currency, gp_commission, pay_status, gp_status, in_gp, anchors, page_url, article_deadline")
        .eq("team_id", team.id)
        .eq("med_base", contact)
        .order("id")
        .range(from, to),
    ),
    supabase.from("projects").select("id, name").eq("team_id", team.id),
    supabase.from("contacts").select("handle, kind, name, email, telegram, whatsapp, other, notes").eq("team_id", team.id).eq("handle", contact).maybeSingle(),
    supabase
      .from("activities")
      .select("id, channel, direction, subject, body, created_at, donor_id, donor_ids, message_id, is_read")
      .eq("team_id", team.id)
      .eq("handle", contact)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("templates").select("id, name, body").eq("team_id", team.id).eq("kind", "message").order("name"),
    supabase.from("mail_accounts").select("email").maybeSingle(),
  ]);
  const contactRow: Contact = (cData as Contact | null) ?? { handle: contact, kind: "intermediary", name: "", email: /@/.test(contact) ? contact : "", telegram: contact.startsWith("@") ? contact : "", whatsapp: "", other: "", notes: "" };
  const pName = new Map(((pData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const written = work.filter((r) => r.indicator).length;
  const replied = work.filter((r) => r.indicator === "replied" || ["Price_ok", "client_OK", "Sent_article", "Paid", "Published"].includes(r.core_status)).length;
  const published = work.filter((r) => r.core_status === "Published").length;
  const dropped = work.filter((r) => CORE_NEG.includes(r.core_status)).length;
  const paid: ByCurrency = {};
  for (const r of work) if (payState(r) === "paid") addTo(paid, r.gp_currency, realCost(r));
  const prices = work.filter((r) => r.gp_price != null);
  const avg = prices.length ? prices.reduce((a, r) => a + (r.gp_price ?? 0), 0) / prices.length : null;
  const inWork = new Set(work.map((r) => r.domain));
  const deals: ThreadDeal[] = work.map((r) => {
    const st = stageOf(r);
    return {
      id: r.id,
      domain: r.domain,
      project_id: r.project_id,
      project: pName.get(r.project_id) ?? "",
      stage: t(STAGE_KEY[st]),
      live: st !== "published" && st !== "lost",
      fill: { domain: r.domain, anchors: r.anchors, page_url: r.page_url, gp_price: r.gp_price, gp_currency: r.gp_currency, article_deadline: r.article_deadline },
    };
  });
  const free = sites.filter((s) => !inWork.has(s.domain));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <Link href="/app/intermediaries" className="text-sm underline">← {t("nav.intermediaries")}</Link>
        <h1 className="mt-1 break-all font-display text-2xl font-semibold tracking-tight">{contact || "—"}</h1>
      </div>
      {contact && (
        <ContactThread
          handle={contact}
          email={emailOf(contact, contactRow.email)}
          mail={(mData as { email: string } | null)?.email ?? null}
          deals={deals}
          items={(aData ?? []) as ThreadItem[]}
          templates={(tData ?? []) as { id: string; name: string; body: string }[]}
        />
      )}
      {contact && <ContactEditor initial={contactRow} />}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(sites.length), t("medp.sites")],
          [written ? `${Math.round((replied / written) * 100)}%` : "—", t("medp.replyRate")],
          [String(published), t("medp.published")],
          [avg == null ? "—" : fmtAmount(avg, prices[0]?.gp_currency || "USD", intl), t("medp.avgPrice")],
        ].map(([v, l]) => (
          <div key={l} className="card">
            <p className="font-mono text-xl font-semibold">{v}</p>
            <p className="text-xs text-mute">{l}</p>
          </div>
        ))}
      </section>
      <p className="text-sm text-mute">{t("medp.summary", { dropped, paid: fmtMoney(paid, intl) })}</p>

      {free.length > 0 && (
        <section className="card">
          <p className="lbl mb-1">{t("medp.free", { n: free.length })}</p>
          <p className="mb-2 text-sm text-mute">{t("medp.freeHint")}</p>
          <ul className="grid gap-1 font-mono text-sm sm:grid-cols-2">
            {free.map((s) => <li key={s.domain}>{s.domain} <span className="text-mute">{s.price}</span></li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <p className="lbl mb-2">{t("medp.history")}</p>
        {work.length === 0 ? (
          <p className="text-sm text-mute">{t("common.none")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {work.map((r) => (
              <li key={r.id}>
                <Link href={`/app/projects/${r.project_id}?tab=work&q=${encodeURIComponent(r.domain)}`} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono">{r.domain}</span>
                  <span className="pill max-sm:hidden">{pName.get(r.project_id)}</span>
                  <span className="pill">{t(STAGE_KEY[stageOf(r)])}</span>
                  {r.gp_price != null && <span className="font-mono text-xs">{fmtAmount(r.gp_price, r.gp_currency || "USD", intl)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
