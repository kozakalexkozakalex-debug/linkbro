"use server";

// Сделка (донор в работе проекта): переписка по любому каналу, контакт посредника, цены с историей.
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { normalizeDomain } from "@/lib/global";
import { CURRENCIES } from "@/lib/money";
import { setStage } from "./actions";
import { STAGES } from "@/lib/stages";

type Ok = { ok: true } | { ok: false; error: string };
export type Channel = "email" | "telegram" | "whatsapp" | "exchange" | "call" | "note";
const CHANNELS: Channel[] = ["email", "telegram", "whatsapp", "exchange", "call", "note"];

export type Contact = { handle: string; kind: string; name: string; email: string; telegram: string; whatsapp: string; other: string; notes: string };
export type Activity = { donor_ids?: string[]; id: string; channel: Channel; direction?: string; subject?: string; is_read?: boolean; body: string; handle: string; created_at: string; created_by: string | null; project_id: string | null; donor_id: string | null };
export type OfferKind = "quote" | "counter" | "agreed" | "extra";
export type Offer = { id: string; domain: string; handle: string; price: number; currency: string; note: string; created_at: string; kind: OfferKind; donor_id: string | null };
export type WriterLite = { id: string; name: string; contact: string; rate: number | null; rate_unit: string; currency: string };
export type Payment = { id: string; payee_kind: string; payee: string; amount: number; currency: string; status: string; paid_at: string | null; note: string; created_at: string; project_id: string | null; donor_id: string | null };
export type TemplateLite = { id: string; kind: "message" | "brief"; name: string; body: string };
export type DealPanel = {
  mail: string | null; // подключённый ящик текущего пользователя
  templates: TemplateLite[];
  writers: WriterLite[];
  payments: Payment[];
  activities: Activity[];
  contact: Contact | null;
  offers: Offer[];
  sameMed: { project: string; domain: string; status: string }[];
  budget: { limit: number | null; currency: string }; // ліміт ціни за посилання в проєкті
};

const EMPTY_CONTACT = (handle: string): Contact => ({
  handle,
  kind: "intermediary",
  name: "",
  email: /^[^@\s]+@[^@\s]+$/.test(handle) ? handle : "",
  telegram: handle.startsWith("@") ? handle : "",
  whatsapp: "",
  other: "",
  notes: "",
});

export async function getDealPanel(donorId: string, domain: string, handle: string): Promise<DealPanel> {
  const { supabase, team } = await getTeamContext();
  const h = handle.trim();
  const [acts, contact, offers, same, writers, pays, tpls, mail, proj] = await Promise.all([
    supabase.from("activities").select("id, channel, direction, subject, is_read, body, handle, created_at, created_by, project_id, donor_id, donor_ids").eq("team_id", team.id).or(`donor_id.eq.${donorId},donor_ids.cs.{${donorId}}`).order("created_at", { ascending: false }).limit(100),
    h ? supabase.from("contacts").select("handle, kind, name, email, telegram, whatsapp, other, notes").eq("team_id", team.id).eq("handle", h).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("offers").select("id, domain, handle, price, currency, note, created_at, kind, donor_id").eq("team_id", team.id).eq("domain", domain).order("created_at", { ascending: false }).limit(80),
    h
      ? supabase.from("project_donors").select("domain, core_status, projects(name)").eq("team_id", team.id).eq("med_base", h).neq("id", donorId).limit(50)
      : Promise.resolve({ data: [] }),
    supabase.from("writers").select("id, name, contact, rate, rate_unit, currency").eq("team_id", team.id).order("name"),
    supabase.from("payments").select("id, payee_kind, payee, amount, currency, status, paid_at, note, created_at, project_id, donor_id").eq("team_id", team.id).eq("donor_id", donorId).order("created_at", { ascending: false }),
    supabase.from("templates").select("id, kind, name, body").eq("team_id", team.id).order("name"),
    supabase.from("mail_accounts").select("email").maybeSingle(),
    supabase.from("project_donors").select("projects(link_budget, budget_currency)").eq("id", donorId).eq("team_id", team.id).maybeSingle(),
  ]);
  const pj = (proj.data as unknown as { projects: { link_budget: number | null; budget_currency: string } | { link_budget: number | null; budget_currency: string }[] | null } | null)?.projects;
  const pjOne = Array.isArray(pj) ? pj[0] : pj;
  return {
    budget: { limit: pjOne?.link_budget ?? null, currency: pjOne?.budget_currency || "USD" },
    mail: (mail.data as { email: string } | null)?.email ?? null,
    templates: (tpls.data ?? []) as TemplateLite[],
    writers: (writers.data ?? []) as WriterLite[],
    payments: (pays.data ?? []) as Payment[],
    activities: (acts.data ?? []) as Activity[],
    contact: h ? ((contact.data as Contact | null) ?? EMPTY_CONTACT(h)) : null,
    offers: (offers.data ?? []) as Offer[],
    sameMed: ((same.data ?? []) as unknown as { domain: string; core_status: string; projects: { name: string } | { name: string }[] | null }[]).map((r) => ({
      project: (Array.isArray(r.projects) ? r.projects[0]?.name : r.projects?.name) ?? "",
      domain: r.domain,
      status: r.core_status,
    })),
  };
}

// Запись в ленту: «написал в Telegram», «ответил: 80$», заметка. По желанию — цена в историю и следующий шаг.
export async function logActivity(input: {
  projectId: string;
  donorId: string;
  channel: Channel;
  body: string;
  sent?: boolean; // мы написали посреднику
  replied?: boolean; // посредник ответил
  price?: string;
  currency?: string;
  nextAt?: string;
  nextText?: string;
}): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  if (!CHANNELS.includes(input.channel)) return { ok: false, error: t("err.unknownValue") };
  const { data: d } = await supabase.from("project_donors").select("id, domain, med_base, indicator, comm_status, core_status").eq("id", input.donorId).eq("team_id", team.id).maybeSingle();
  const donor = d as { id: string; domain: string; med_base: string; indicator: string | null; comm_status: string; core_status: string } | null;
  if (!donor) return { ok: false, error: t("err.donorNotFound") };

  const price = input.price?.trim() ? Number(input.price.replace(/\s/g, "").replace(",", ".")) : null;
  if (price != null && (!Number.isFinite(price) || price < 0)) return { ok: false, error: t("err.needNumber") };
  const currency = (CURRENCIES as readonly string[]).includes(input.currency ?? "") ? (input.currency as string) : "USD";

  let body = input.body.trim().slice(0, 4000);
  if (price != null) body = `${body}${body ? " · " : ""}${price} ${currency}`;
  if (!body && !input.sent && !input.replied && !input.nextAt) return { ok: true };

  const { error } = await supabase.from("activities").insert({
    team_id: team.id,
    project_id: input.projectId,
    donor_id: donor.id,
    handle: donor.med_base,
    channel: input.channel,
    body: body || (input.replied ? "↩" : input.sent ? "→" : ""),
  });
  if (error) return { ok: false, error: error.message };

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();
  if (input.replied) {
    patch.indicator = "replied";
    patch.indicator_at = now;
    if (donor.comm_status === "" || donor.comm_status === "Contacted") patch.comm_status = "In Discussion";
  } else if (input.sent && donor.indicator !== "replied") {
    patch.indicator = "waiting";
    patch.indicator_at = now;
    if (!donor.comm_status) patch.comm_status = "Contacted";
    if (["new_core", "OK_Cat", ""].includes(donor.core_status)) patch.core_status = "In communication";
    patch.in_comm = true;
  }
  if (price != null) {
    patch.gp_price = price;
    patch.gp_currency = currency;
    await supabase.from("offers").insert({ team_id: team.id, domain: donor.domain, handle: donor.med_base, price, currency, note: input.channel });
  }
  if (input.nextAt !== undefined) {
    if (input.nextAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextAt)) return { ok: false, error: t("err.date") };
    patch.next_action_at = input.nextAt || null;
    patch.next_action = (input.nextText ?? "").trim().slice(0, 200);
  }
  if (Object.keys(patch).length) {
    const { error: e2 } = await supabase.from("project_donors").update(patch).eq("id", donor.id).eq("team_id", team.id);
    if (e2) return { ok: false, error: e2.message };
  }
  revalidatePath(`/app/projects/${input.projectId}`);
  revalidatePath("/app/today");
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase.from("activities").delete().eq("id", id).eq("team_id", team.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Каналы связи посредника (почта, Telegram, WhatsApp, биржа)
export async function saveContact(c: Contact): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const handle = c.handle.trim().slice(0, 300);
  if (!handle) return { ok: false, error: (await getI18n()).t("err.enterName") };
  const kind = ["intermediary", "owner", "exchange"].includes(c.kind) ? c.kind : "intermediary";
  const clip = (s: string, n = 300) => (s ?? "").trim().slice(0, n);
  const { error } = await supabase.from("contacts").upsert(
    {
      team_id: team.id,
      handle,
      kind,
      name: clip(c.name),
      email: clip(c.email),
      telegram: clip(c.telegram),
      whatsapp: clip(c.whatsapp),
      other: clip(c.other),
      notes: clip(c.notes, 2000),
    },
    { onConflict: "team_id,handle" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/intermediaries");
  return { ok: true };
}

// Новая цена посредника на домен (история не перезаписывается)
export async function addOffer(domainRaw: string, handle: string, priceRaw: string, currencyRaw: string, note = ""): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const domain = normalizeDomain(domainRaw);
  if (!domain) return { ok: false, error: t("err.checkDomain") };
  const price = Number(priceRaw.replace(/\s/g, "").replace(",", "."));
  if (!priceRaw.trim() || !Number.isFinite(price) || price < 0) return { ok: false, error: t("err.needNumber") };
  const currency = (CURRENCIES as readonly string[]).includes(currencyRaw) ? currencyRaw : "USD";
  const { error } = await supabase.from("offers").insert({ team_id: team.id, domain, handle: handle.trim(), price, currency, note: note.slice(0, 300) });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------- Выплаты: посредникам, авторам, биржам ----------
export async function addPayment(input: {
  projectId?: string | null;
  donorId?: string | null;
  payeeKind: string;
  payee: string;
  amount: string;
  currency: string;
  note?: string;
  paid?: boolean;
}): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const amount = Number(input.amount.replace(/\s/g, "").replace(",", "."));
  if (!input.amount.trim() || !Number.isFinite(amount) || amount < 0) return { ok: false, error: t("err.needNumber") };
  const kind = ["intermediary", "writer", "exchange", "other"].includes(input.payeeKind) ? input.payeeKind : "other";
  const currency = (CURRENCIES as readonly string[]).includes(input.currency) ? input.currency : "USD";
  const { error } = await supabase.from("payments").insert({
    team_id: team.id,
    project_id: input.projectId || null,
    donor_id: input.donorId || null,
    payee_kind: kind,
    payee: input.payee.trim().slice(0, 300),
    amount,
    currency,
    note: (input.note ?? "").slice(0, 1000),
    status: input.paid ? "paid" : "due",
    paid_at: input.paid ? new Date().toISOString() : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/finance");
  return { ok: true };
}

export async function setPaymentStatus(id: string, paid: boolean): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase
    .from("payments")
    .update({ status: paid ? "paid" : "due", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("team_id", team.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/finance");
  return { ok: true };
}

export async function deletePayment(id: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase.from("payments").delete().eq("id", id).eq("team_id", team.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/finance");
  return { ok: true };
}

// ---------- Ціна і бюджет: запис у історію + рішення ----------
// quote — його ціна, counter — наша пропозиція, agreed — погоджено, extra — дод. витрати.
// accept — прийняти останню ціну, defer — відкласти на тиждень, decline — відмовитись (дорого).
export async function priceAction(input: {
  projectId: string;
  donorId: string;
  action: OfferKind | "accept" | "defer" | "decline";
  amount?: string;
  currency?: string;
  note?: string;
}): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const { data: d } = await supabase
    .from("project_donors")
    .select("id, domain, med_base, stage, gp_price, gp_currency, extra_cost")
    .eq("id", input.donorId)
    .eq("team_id", team.id)
    .maybeSingle();
  const deal = d as { id: string; domain: string; med_base: string; stage: string; gp_price: number | null; gp_currency: string; extra_cost: number } | null;
  if (!deal) return { ok: false, error: t("err.donorNotFound") };
  const idx = (st: string) => (STAGES as readonly string[]).indexOf(st);
  const moveTo = async (st: string) => {
    if (deal.stage !== "lost" && idx(deal.stage) < idx(st)) {
      const r = await setStage(deal.id, input.projectId, st);
      if (!r.ok) return r;
    }
    return { ok: true } as Ok;
  };
  const currency = (CURRENCIES as readonly string[]).includes(input.currency ?? "") ? (input.currency as string) : deal.gp_currency || "USD";
  const num = (raw?: string) => {
    const n = Number((raw ?? "").replace(/\s/g, "").replace(",", "."));
    return raw?.trim() && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const log = (kind: OfferKind, price: number) =>
    supabase.from("offers").insert({ team_id: team.id, domain: deal.domain, handle: deal.med_base, price, currency, note: (input.note ?? "").slice(0, 300), kind, donor_id: deal.id });

  if (input.action === "defer") {
    const at = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await supabase.from("project_donors").update({ next_action_at: at, next_action: t("pr.deferTask") }).eq("id", deal.id).eq("team_id", team.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/projects/${input.projectId}`);
    return { ok: true };
  }
  if (input.action === "decline") {
    await supabase.from("project_donors").update({ reject_reason: "price" }).eq("id", deal.id).eq("team_id", team.id);
    return setStage(deal.id, input.projectId, "lost");
  }

  let price = num(input.amount);
  if (input.action === "accept") {
    // Прийняти: введена сума, інакше остання ціна (його або наша)
    if (price == null) {
      const { data: last } = await supabase.from("offers").select("price").eq("donor_id", deal.id).in("kind", ["quote", "counter"]).order("created_at", { ascending: false }).limit(1);
      price = ((last ?? []) as { price: number }[])[0]?.price ?? deal.gp_price;
    }
    if (price == null) return { ok: false, error: t("pr.needPrice") };
    const { error } = await log("agreed", price);
    if (error) return { ok: false, error: error.message };
    await supabase.from("project_donors").update({ gp_price: price, gp_currency: currency }).eq("id", deal.id).eq("team_id", team.id);
    const r = await moveTo("agreed");
    revalidatePath(`/app/projects/${input.projectId}`);
    return r;
  }
  if (price == null) return { ok: false, error: t("err.needNumber") };
  const { error } = await log(input.action, price);
  if (error) return { ok: false, error: error.message };
  if (input.action === "extra") {
    await supabase.from("project_donors").update({ extra_cost: (Number(deal.extra_cost) || 0) + price }).eq("id", deal.id).eq("team_id", team.id);
  } else if (input.action === "agreed") {
    await supabase.from("project_donors").update({ gp_price: price, gp_currency: currency }).eq("id", deal.id).eq("team_id", team.id);
    const r = await moveTo("agreed");
    if (!r.ok) return r;
  } else {
    // Його ціна → поточна ціна угоди; будь-яка ціна означає, що ми вже в переговорах
    if (input.action === "quote") await supabase.from("project_donors").update({ gp_price: price, gp_currency: currency }).eq("id", deal.id).eq("team_id", team.id);
    const r = await moveTo("negotiating");
    if (!r.ok) return r;
  }
  revalidatePath(`/app/projects/${input.projectId}`);
  return { ok: true };
}
