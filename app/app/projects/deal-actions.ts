"use server";

// Сделка (донор в работе проекта): переписка по любому каналу, контакт посредника, цены с историей.
import { revalidatePath } from "next/cache";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import { normalizeDomain } from "@/lib/global";
import { CURRENCIES } from "@/lib/money";

type Ok = { ok: true } | { ok: false; error: string };
export type Channel = "email" | "telegram" | "whatsapp" | "exchange" | "call" | "note";
const CHANNELS: Channel[] = ["email", "telegram", "whatsapp", "exchange", "call", "note"];

export type Contact = { handle: string; kind: string; name: string; email: string; telegram: string; whatsapp: string; other: string; notes: string };
export type Activity = { id: string; channel: Channel; body: string; handle: string; created_at: string; created_by: string | null; project_id: string | null; donor_id: string | null };
export type Offer = { id: string; domain: string; handle: string; price: number; currency: string; note: string; created_at: string };
export type DealPanel = {
  activities: Activity[];
  contact: Contact | null;
  offers: Offer[];
  sameMed: { project: string; domain: string; status: string }[];
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
  const [acts, contact, offers, same] = await Promise.all([
    supabase.from("activities").select("id, channel, body, handle, created_at, created_by, project_id, donor_id").eq("team_id", team.id).eq("donor_id", donorId).order("created_at", { ascending: false }).limit(100),
    h ? supabase.from("contacts").select("handle, kind, name, email, telegram, whatsapp, other, notes").eq("team_id", team.id).eq("handle", h).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("offers").select("id, domain, handle, price, currency, note, created_at").eq("team_id", team.id).eq("domain", domain).order("created_at", { ascending: false }).limit(50),
    h
      ? supabase.from("project_donors").select("domain, core_status, projects(name)").eq("team_id", team.id).eq("med_base", h).neq("id", donorId).limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  return {
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
