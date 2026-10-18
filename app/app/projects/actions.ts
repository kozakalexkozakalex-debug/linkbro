"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import type { MsgKey } from "@/lib/i18n/config";
import { fetchAll, chunk } from "@/lib/fetchAll";
import { DEFAULT_FILTER, GLOBAL_COLUMNS, METRICS, normalizeDomain, passesFilter, type GlobalDonor, type MetricFilter } from "@/lib/global";
import { checkLink } from "@/lib/linkcheck";
import { CURRENCIES, SOURCES } from "@/lib/money";
import {
  COMM_STATUSES,
  CORE_NEG,
  CORE_POS,
  DONOR_TEXT_FIELDS,
  GP_STATUSES,
  INDICATORS,
  OPENS_COMM,
  OPENS_GP,
  normalizeFilter,
  priceNumber,
  type DonorTextField,
  type FgStatus,
} from "@/lib/project";

type Ok = { ok: true } | { ok: false; error: string };
const fail = (error: string): Ok => ({ ok: false, error });
async function tr(key: MsgKey, vars?: Record<string, string | number>) {
  const { t } = await getI18n();
  return t(key, vars);
}

function refresh(projectId?: string) {
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
}

// ---------- Проект: создать, изменить, фильтр, стоп-листы ----------

export async function createProject(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const name = String(formData.get("name") ?? "").trim();
  const plan = Math.max(0, parseInt(String(formData.get("plan") ?? "0"), 10) || 0);
  const niche = String(formData.get("niche") ?? "").trim().slice(0, 60);
  if (!name) redirect("/app/projects/new?error=" + encodeURIComponent(await tr("err.projectName")));

  const { data, error } = await supabase
    .from("projects")
    .insert({ team_id: team.id, name, niche, plan_per_month: plan, metric_filter: DEFAULT_FILTER })
    .select("id")
    .single();
  if (error || !data) redirect("/app/projects/new?error=" + encodeURIComponent(await tr("err.onlyLeadProject")));

  revalidatePath("/app", "layout");
  redirect(`/app/projects/${(data as { id: string }).id}?tab=profile`);
}

export async function updateProject(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("id") ?? "");
  const patch = {
    name: String(formData.get("name") ?? "").trim() || "Project",
    niche: String(formData.get("niche") ?? "").trim().slice(0, 60),
    client_site: String(formData.get("client_site") ?? "").trim().slice(0, 300),
    geo: String(formData.get("geo") ?? "").trim().slice(0, 100),
    language: String(formData.get("language") ?? "").trim().slice(0, 60),
    monthly_budget: (() => {
      const t = String(formData.get("monthly_budget") ?? "").replace(/\s/g, "").replace(",", ".");
      const n = t === "" ? null : Number(t);
      return n != null && Number.isFinite(n) && n >= 0 ? n : null;
    })(),
    budget_currency: (CURRENCIES as readonly string[]).includes(String(formData.get("budget_currency"))) ? String(formData.get("budget_currency")) : "USD",
    plan_per_month: Math.max(0, parseInt(String(formData.get("plan") ?? "0"), 10) || 0),
    requirements: String(formData.get("requirements") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const { error } = await supabase.from("projects").update(patch).eq("id", id).eq("team_id", team.id);
  const q = error ? "&error=" + encodeURIComponent(await tr("err.onlyLeadEditProject")) : "&saved=1";
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${id}?tab=profile${q}`);
}

export async function saveProjectFilter(projectId: string, filter: MetricFilter): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const clean: Record<string, { min: string; max: string }> = {};
  for (const m of METRICS) clean[m.key] = { min: String(filter[m.key]?.min ?? "").trim(), max: String(filter[m.key]?.max ?? "").trim() };
  const { error } = await supabase.from("projects").update({ metric_filter: clean }).eq("id", projectId).eq("team_id", team.id);
  if (error) return fail(await tr("err.onlyLeadFilter"));
  refresh(projectId);
  return { ok: true };
}

export async function saveStoplist(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const projectId = String(formData.get("project_id") ?? "");
  const source = formData.get("source") === "global" ? "global" : "tools";
  const domains = [
    ...new Set(
      String(formData.get("domains") ?? "")
        .split(/\r?\n/)
        .map((l) => normalizeDomain(l))
        .filter((d): d is string => !!d),
    ),
  ];

  const back = `/app/projects/${projectId}?tab=profile`;
  const { error: delErr } = await supabase
    .from("project_stoplist")
    .delete()
    .eq("project_id", projectId)
    .eq("team_id", team.id)
    .eq("source", source);
  if (delErr) redirect(back + "&error=" + encodeURIComponent(await tr("err.onlyLeadStoplist")));

  for (const part of chunk(domains, 500)) {
    const rows = part.map((domain) => ({ project_id: projectId, team_id: team.id, domain, source }));
    const { error } = await supabase.from("project_stoplist").insert(rows);
    if (error) redirect(back + "&error=" + encodeURIComponent(await tr("err.saveStoplist", { x: error.message })));
  }
  refresh(projectId);
  redirect(back + "&saved=1");
}

// ---------- Глобал → проекты ----------

export type TransferReport = { report: { name: string; added: number; filtered: number; stopped: number }[]; error?: string };

export async function transferToProjects(): Promise<TransferReport> {
  const { supabase, team } = await getTeamContext();
  try {
    const fit = await fetchAll<GlobalDonor>((from, to) =>
      supabase.from("global_donors").select(GLOBAL_COLUMNS).eq("team_id", team.id).eq("status", "fit").order("id").range(from, to),
    );
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, name, metric_filter")
      .eq("team_id", team.id)
      .order("created_at");
    if (pErr) return { report: [], error: pErr.message };

    const report: TransferReport["report"] = [];
    for (const p of (projects ?? []) as { id: string; name: string; metric_filter: unknown }[]) {
      // Блокируют: стоп-лист из инструментов + доноры, которые уже есть в проекте.
      // Не прошедшие фильтр НЕ блокируются: пройдут позже, если поменять фильтр или метрики.
      const tools = await fetchAll<{ domain: string }>((from, to) =>
        supabase.from("project_stoplist").select("domain").eq("project_id", p.id).eq("source", "tools").order("domain").range(from, to),
      );
      const inProject = await fetchAll<{ domain: string }>((from, to) =>
        supabase.from("project_donors").select("domain").eq("project_id", p.id).order("domain").range(from, to),
      );
      const stop = new Set([...tools, ...inProject].map((r) => r.domain));
      const filter = normalizeFilter(p.metric_filter);
      const candidates = fit.filter((d) => !stop.has(d.domain));
      const passed = candidates.filter((d) => passesFilter(d, filter));

      for (const part of chunk(passed, 500)) {
        const { error } = await supabase
          .from("project_donors")
          .upsert(
            part.map((d) => ({ project_id: p.id, team_id: team.id, domain: d.domain })),
            { onConflict: "project_id,domain", ignoreDuplicates: true },
          );
        if (error) throw new Error(error.message);
      }
      // Переданные записываем в Стоп-лист (Глобал) — история того, что уже приходило в проект
      for (const part of chunk(passed, 500)) {
        const { error } = await supabase
          .from("project_stoplist")
          .upsert(
            part.map((d) => ({ project_id: p.id, team_id: team.id, domain: d.domain, source: "global" })),
            { onConflict: "project_id,source,domain", ignoreDuplicates: true },
          );
        if (error) throw new Error(error.message);
      }
      report.push({ name: p.name, added: passed.length, filtered: candidates.length - passed.length, stopped: fit.length - candidates.length });
      revalidatePath(`/app/projects/${p.id}`);
    }
    revalidatePath("/app", "layout");
    return { report };
  } catch (e) {
    return { report: [], error: e instanceof Error ? e.message : await tr("err.unknown") };
  }
}

// ---------- Донор проекта: поля и статусы ----------

async function loadCustom(kind: "core_pos" | "core_neg" | "comm") {
  const { supabase, team } = await getTeamContext();
  const { data } = await supabase.from("custom_statuses").select("name").eq("team_id", team.id).eq("kind", kind);
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

export async function updateDonorField(id: string, field: DonorTextField, raw: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  let value: string | number | null;
  if (field === "gp_price") {
    const t = raw.trim();
    value = t === "" ? null : priceNumber(t);
    if (t !== "" && value == null) return fail(await tr("err.needNumber"));
  } else if ((DONOR_TEXT_FIELDS as readonly string[]).includes(field)) {
    value = raw.trim().slice(0, 2000);
  } else {
    return fail(await tr("err.notEditable"));
  }
  const { error } = await supabase.from("project_donors").update({ [field]: value }).eq("id", id).eq("team_id", team.id);
  return error ? fail(error.message) : { ok: true };
}

export async function setFgStatus(id: string, projectId: string, status: FgStatus): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  if (!["new", "core", "out"].includes(status)) return fail(await tr("err.unknownStatus"));
  const { error } = await supabase.from("project_donors").update({ fg_status: status }).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

export async function setCoreStatus(id: string, projectId: string, status: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const allowed = ["new_core", ...CORE_POS, ...CORE_NEG, ...(await loadCustom("core_pos")), ...(await loadCustom("core_neg"))];
  if (!allowed.includes(status)) return fail(await tr("err.unknownStatus"));

  const { data: cur } = await supabase
    .from("project_donors")
    .select("med_base, price_base, gp_med, gp_price, published_at, gp_source, guarantee_until")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!cur) return fail(await tr("err.donorNotFound"));
  const c = cur as {
    med_base: string;
    price_base: string;
    gp_med: string;
    gp_price: number | null;
    published_at: string | null;
    gp_source: string;
    guarantee_until: string | null;
  };

  const patch: Record<string, unknown> = { core_status: status };
  if (status === OPENS_COMM) patch.in_comm = true;
  if (OPENS_GP.includes(status)) {
    patch.in_comm = true;
    patch.in_gp = true;
    if (!c.gp_med) patch.gp_med = c.med_base;
    if (c.gp_price == null) patch.gp_price = priceNumber(c.price_base);
  }
  if (status === "Published" && !c.published_at) {
    patch.published_at = new Date().toISOString();
    const src = SOURCES.find((x) => x.name === c.gp_source);
    if (!c.guarantee_until && src && src.guaranteeDays > 0) patch.guarantee_until = addDays(new Date(), src.guaranteeDays);
  }

  const { error } = await supabase.from("project_donors").update(patch).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

export async function setCommStatus(id: string, projectId: string, status: string): Promise<Ok> {
  const allowed = ["", ...COMM_STATUSES, ...(await loadCustom("comm"))];
  if (!allowed.includes(status)) return fail(await tr("err.unknownStatus"));
  const { supabase, team } = await getTeamContext();
  const { error } = await supabase.from("project_donors").update({ comm_status: status }).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  // Accepted → донор переходит в Guest Posting
  if (status === "Accepted") return setCoreStatus(id, projectId, "Price_ok");
  refresh(projectId);
  return { ok: true };
}

export async function setIndicator(id: string, projectId: string, value: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const ok = value === "" || INDICATORS.some((i) => i.value === value);
  if (!ok) return fail(await tr("err.unknownValue"));
  const patch: Record<string, unknown> = { indicator: value || null, indicator_at: value ? new Date().toISOString() : null };
  if (value === "replied") {
    const { data } = await supabase.from("project_donors").select("comm_status").eq("id", id).eq("team_id", team.id).maybeSingle();
    if ((data as { comm_status: string } | null)?.comm_status === "Contacted") patch.comm_status = "In Discussion";
  }
  const { error } = await supabase.from("project_donors").update(patch).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

export async function setGpStatus(id: string, projectId: string, status: string): Promise<Ok> {
  if (status !== "" && !GP_STATUSES.includes(status)) return fail(await tr("err.unknownStatus"));
  const { supabase, team } = await getTeamContext();
  const patch: Record<string, unknown> = { gp_status: status };
  if (status === "Paid") {
    patch.pay_status = "paid";
    patch.paid_at = new Date().toISOString();
  }
  if (status === "Need to pay") {
    const { data } = await supabase.from("project_donors").select("pay_status").eq("id", id).eq("team_id", team.id).maybeSingle();
    if (!(data as { pay_status: string } | null)?.pay_status) patch.pay_status = "due";
  }
  const { error } = await supabase.from("project_donors").update(patch).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

export async function setAssignee(id: string, projectId: string, userId: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  if (userId) {
    const { data } = await supabase.from("team_members").select("user_id").eq("team_id", team.id).eq("user_id", userId).maybeSingle();
    if (!data) return fail(await tr("err.notInTeam"));
  }
  const { error } = await supabase.from("project_donors").update({ assignee: userId || null }).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

export async function addCustomStatus(kind: "core_pos" | "core_neg" | "comm", name: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const n = name.trim().slice(0, 60);
  if (!n) return fail(await tr("err.enterName"));
  if (!["core_pos", "core_neg", "comm"].includes(kind)) return fail(await tr("err.unknownType"));
  const { error } = await supabase
    .from("custom_statuses")
    .upsert({ team_id: team.id, kind, name: n }, { onConflict: "team_id,kind,name", ignoreDuplicates: true });
  return error ? fail(error.message) : { ok: true };
}

// ---------- Communication: посредники и письма ----------

export type SyncResult = { wrote: number; found: number; error?: string };

export async function syncIntermediaries(projectId: string): Promise<SyncResult> {
  const { supabase, team } = await getTeamContext();
  try {
    const rows = await fetchAll<{ id: string; domain: string; med_base: string; med_add: string; price_base: string; price_add: string }>(
      (from, to) =>
        supabase
          .from("project_donors")
          .select("id, domain, med_base, med_add, price_base, price_add")
          .eq("project_id", projectId)
          .eq("team_id", team.id)
          .eq("in_comm", true)
          .order("id")
          .range(from, to),
    );
    if (rows.length === 0) return { wrote: 0, found: 0 };

    const base = new Map<string, { intermediary: string; price: string }>();
    for (const part of chunk(rows.map((r) => r.domain), 200)) {
      const { data, error } = await supabase
        .from("intermediaries")
        .select("domain, intermediary, price")
        .eq("team_id", team.id)
        .in("domain", part);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as { domain: string; intermediary: string; price: string }[]) base.set(r.domain, r);
    }

    let wrote = 0;
    let found = 0;
    for (const r of rows) {
      const cur = base.get(r.domain);
      if (r.med_add.trim() || r.price_add.trim()) {
        // Новые данные вручную → в базу посредников и в поля (БАЗА)
        const next = { intermediary: r.med_add.trim() || cur?.intermediary || "", price: r.price_add.trim() || cur?.price || "" };
        const { error } = await supabase
          .from("intermediaries")
          .upsert({ team_id: team.id, domain: r.domain, ...next }, { onConflict: "team_id,domain" });
        if (error) throw new Error(error.message);
        await supabase
          .from("project_donors")
          .update({ med_base: next.intermediary, price_base: next.price, med_add: "", price_add: "" })
          .eq("id", r.id)
          .eq("team_id", team.id);
        base.set(r.domain, next);
        wrote++;
      } else if (cur && (cur.intermediary !== r.med_base || cur.price !== r.price_base)) {
        // Есть в базе → подтягиваем
        await supabase
          .from("project_donors")
          .update({ med_base: cur.intermediary, price_base: cur.price })
          .eq("id", r.id)
          .eq("team_id", team.id);
        found++;
      }
    }
    refresh(projectId);
    revalidatePath("/app/intermediaries");
    return { wrote, found };
  } catch (e) {
    return { wrote: 0, found: 0, error: e instanceof Error ? e.message : await tr("err.unknown") };
  }
}

// Письма отправлены вручную → Contacted, индикатор «очікування»
export async function markContacted(projectId: string, ids: string[]): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const now = new Date().toISOString();
  for (const part of chunk(ids, 200)) {
    const { error } = await supabase
      .from("project_donors")
      .update({ indicator: "waiting", indicator_at: now })
      .eq("team_id", team.id)
      .eq("project_id", projectId)
      .in("id", part);
    if (error) return fail(error.message);
    await supabase
      .from("project_donors")
      .update({ comm_status: "Contacted" })
      .eq("team_id", team.id)
      .eq("project_id", projectId)
      .eq("comm_status", "")
      .in("id", part);
  }
  refresh(projectId);
  return { ok: true };
}

// ---------- База посредников (отдельная страница) ----------

export async function updateIntermediary(domain: string, field: "intermediary" | "price", value: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  if (field !== "intermediary" && field !== "price") return fail(await tr("err.notEditable"));
  const { error } = await supabase
    .from("intermediaries")
    .update({ [field]: value.trim().slice(0, 300) })
    .eq("team_id", team.id)
    .eq("domain", domain);
  return error ? fail(error.message) : { ok: true };
}

export async function addIntermediary(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) redirect("/app/intermediaries?error=" + encodeURIComponent(await tr("err.checkDomain")));
  const { error } = await supabase.from("intermediaries").upsert(
    {
      team_id: team.id,
      domain,
      intermediary: String(formData.get("intermediary") ?? "").trim(),
      price: String(formData.get("price") ?? "").trim(),
    },
    { onConflict: "team_id,domain" },
  );
  if (error) redirect("/app/intermediaries?error=" + encodeURIComponent(error.message));
  revalidatePath("/app/intermediaries");
  redirect("/app/intermediaries");
}

// ---------- Деньги, гарантия, индексация ----------

function addDays(from: Date, days: number): string {
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export type DonorValueField = "gp_source" | "gp_currency" | "gp_commission" | "pay_status" | "guarantee_until" | "indexed";

export async function setDonorValue(id: string, projectId: string, field: DonorValueField, raw: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const patch: Record<string, unknown> = {};
  const v = raw.trim();

  if (field === "gp_source") {
    patch.gp_source = v.slice(0, 60);
    const src = SOURCES.find((x) => x.name === v);
    const { data } = await supabase
      .from("project_donors")
      .select("gp_commission, guarantee_until, published_at")
      .eq("id", id)
      .eq("team_id", team.id)
      .maybeSingle();
    const cur = data as { gp_commission: number; guarantee_until: string | null; published_at: string | null } | null;
    if (src && cur) {
      if (!Number(cur.gp_commission) && src.commission) patch.gp_commission = src.commission;
      if (!cur.guarantee_until && cur.published_at && src.guaranteeDays) patch.guarantee_until = addDays(new Date(cur.published_at), src.guaranteeDays);
    }
  } else if (field === "gp_currency") {
    if (!(CURRENCIES as readonly string[]).includes(v)) return fail(await tr("err.unknownCurrency"));
    patch.gp_currency = v;
  } else if (field === "gp_commission") {
    const n = v === "" ? 0 : Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) return fail(await tr("err.commission"));
    patch.gp_commission = n;
  } else if (field === "pay_status") {
    if (!["", "due", "paid", "refund"].includes(v)) return fail(await tr("err.unknownStatus"));
    patch.pay_status = v;
    patch.paid_at = v === "paid" ? new Date().toISOString() : null;
  } else if (field === "guarantee_until") {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(await tr("err.date"));
    patch.guarantee_until = v || null;
  } else if (field === "indexed") {
    patch.indexed = v === "yes" ? true : v === "no" ? false : null;
  } else {
    return fail(await tr("err.notEditable"));
  }

  const { error } = await supabase.from("project_donors").update(patch).eq("id", id).eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

// ---------- Проверка ссылки вручную ----------

export async function checkDonorLink(id: string, projectId: string): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const { data } = await supabase
    .from("project_donors")
    .select("article_url, page_url, anchors")
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!data) return fail(await tr("err.donorNotFound"));
  const d = data as { article_url: string; page_url: string; anchors: string };
  const r = await checkLink(d.article_url, d.page_url, d.anchors);
  const { error } = await supabase
    .from("project_donors")
    .update({ link_status: r.status, link_note: r.note, link_checked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("team_id", team.id);
  if (error) return fail(error.message);
  refresh(projectId);
  return { ok: true };
}

// ---------- Отчёт для клиента ----------

function newToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

export async function createReportLink(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("project_id") ?? "");
  const { error } = await supabase.from("projects").update({ report_token: newToken() }).eq("id", id).eq("team_id", team.id);
  const q = error ? "&error=" + encodeURIComponent(await tr("err.onlyLeadReport")) : "&saved=1";
  refresh(id);
  redirect(`/app/projects/${id}?tab=profile${q}`);
}

export async function revokeReportLink(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("project_id") ?? "");
  await supabase.from("projects").update({ report_token: null }).eq("id", id).eq("team_id", team.id);
  refresh(id);
  redirect(`/app/projects/${id}?tab=profile&saved=1`);
}

export async function setReportPrices(formData: FormData) {
  const { supabase, team } = await getTeamContext();
  const id = String(formData.get("project_id") ?? "");
  const show = formData.get("show") === "1";
  await supabase.from("projects").update({ report_show_prices: show }).eq("id", id).eq("team_id", team.id);
  refresh(id);
  redirect(`/app/projects/${id}?tab=profile&saved=1`);
}

// ---------- Пакетное сохранение из таблиц проекта ----------
export type CellChange = { id: string; field: string; value: string };

const SPECIAL = ["core_status", "comm_status", "gp_status", "indicator", "fg_status", "gp_source"] as const;

export async function updateDonorsBatch(projectId: string, changes: CellChange[]): Promise<Ok> {
  if (changes.length > 5000) return fail(await tr("err.tooMany", { n: 5000 }));
  const { supabase, team } = await getTeamContext();
  const simple = new Map<string, Record<string, unknown>>();
  const special: CellChange[] = [];
  let members: Set<string> | null = null;
  const put = (id: string, patch: Record<string, unknown>) => simple.set(id, { ...(simple.get(id) ?? {}), ...patch });

  for (const c of changes) {
    const v = c.value.trim();
    if ((DONOR_TEXT_FIELDS as readonly string[]).includes(c.field)) put(c.id, { [c.field]: v.slice(0, 2000) });
    else if (c.field === "gp_price") {
      const n = v === "" ? null : priceNumber(v);
      if (v !== "" && n == null) return fail(await tr("err.cellPrice", { v }));
      put(c.id, { gp_price: n });
    } else if (c.field === "gp_commission") {
      const n = v === "" ? 0 : Number(v.replace(",", ".").replace("%", ""));
      if (!Number.isFinite(n) || n < 0 || n > 100) return fail(await tr("err.cellCommission", { v }));
      put(c.id, { gp_commission: n });
    } else if (c.field === "gp_currency") {
      if (!(CURRENCIES as readonly string[]).includes(v)) return fail(await tr("err.cellCurrency", { v }));
      put(c.id, { gp_currency: v });
    } else if (c.field === "pay_status") {
      if (!["", "due", "paid", "refund"].includes(v)) return fail(await tr("err.cellPay", { v }));
      put(c.id, { pay_status: v, paid_at: v === "paid" ? new Date().toISOString() : null });
    } else if (c.field === "guarantee_until") {
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(await tr("err.cellDate", { v }));
      put(c.id, { guarantee_until: v || null });
    } else if (c.field === "indexed") {
      put(c.id, { indexed: v === "yes" ? true : v === "no" ? false : null });
    } else if (c.field === "assignee") {
      if (!members) {
        const { data } = await supabase.from("team_members").select("user_id").eq("team_id", team.id);
        members = new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
      }
      if (v && !members.has(v)) return fail(await tr("err.notInTeam"));
      put(c.id, { assignee: v || null });
    } else if ((SPECIAL as readonly string[]).includes(c.field)) special.push(c);
    else return fail(await tr("err.fieldNotEditable", { f: c.field }));
  }

  for (const part of chunk([...simple.entries()], 20)) {
    const res = await Promise.all(
      part.map(([id, patch]) => supabase.from("project_donors").update(patch).eq("id", id).eq("team_id", team.id).eq("project_id", projectId)),
    );
    const bad = res.find((r) => r.error);
    if (bad?.error) return fail(bad.error.message);
  }

  // Статусы с последствиями (переход между модулями, даты) — по одному
  for (const c of special) {
    let r: Ok;
    if (c.field === "core_status") r = await setCoreStatus(c.id, projectId, c.value);
    else if (c.field === "comm_status") r = await setCommStatus(c.id, projectId, c.value);
    else if (c.field === "gp_status") r = await setGpStatus(c.id, projectId, c.value);
    else if (c.field === "indicator") r = await setIndicator(c.id, projectId, c.value);
    else if (c.field === "fg_status") r = await setFgStatus(c.id, projectId, c.value as FgStatus);
    else r = await setDonorValue(c.id, projectId, "gp_source", c.value);
    if (!r.ok) return r;
  }

  refresh(projectId);
  return { ok: true };
}

export async function updateIntermediariesBatch(changes: CellChange[]): Promise<Ok> {
  const { supabase, team } = await getTeamContext();
  const patches = new Map<string, Record<string, string>>();
  for (const c of changes) {
    if (c.field !== "intermediary" && c.field !== "price") return fail(await tr("err.notEditable"));
    patches.set(c.id, { ...(patches.get(c.id) ?? {}), [c.field]: c.value.trim().slice(0, 300) });
  }
  for (const part of chunk([...patches.entries()], 20)) {
    const res = await Promise.all(
      part.map(([domain, patch]) => supabase.from("intermediaries").update(patch).eq("team_id", team.id).eq("domain", domain)),
    );
    const bad = res.find((r) => r.error);
    if (bad?.error) return fail(bad.error.message);
  }
  revalidatePath("/app/intermediaries");
  return { ok: true };
}
