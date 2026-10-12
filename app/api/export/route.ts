// Выгрузка в CSV: глобальная база команды или один проект.
import { getTeamContext } from "@/lib/team";
import { fetchAll } from "@/lib/fetchAll";
import { toCsv } from "@/lib/csv";
import { GLOBAL_COLUMNS, ratioOf, type GlobalDonor } from "@/lib/global";
import { DONOR_COLUMNS, type ProjectDonor } from "@/lib/project";
import { realCost } from "@/lib/money";

export const dynamic = "force-dynamic";

function file(name: string, csv: string) {
  const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60) || "export";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linkbro-${encodeURIComponent(safe)}.csv"; filename*=UTF-8''linkbro-${encodeURIComponent(safe)}.csv`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const { supabase, team } = await getTeamContext();

  if (type === "global") {
    const rows = await fetchAll<GlobalDonor>((from, to) =>
      supabase.from("global_donors").select(GLOBAL_COLUMNS).eq("team_id", team.id).order("added_at").range(from, to),
    );
    const csv = toCsv([
      ["Domain", "Price", "Date Added", "DR", "Keywords", "Traffic", "GEO", "Topics", "TF", "CF", "TF/CF", "Status"],
      ...rows.map((r) => {
        const ratio = ratioOf(r);
        return [r.domain, r.price, r.added_at.slice(0, 10), r.dr, r.keywords, r.traffic, r.geo, r.topics, r.tf, r.cf, ratio == null ? "" : ratio.toFixed(2), r.status.toUpperCase()];
      }),
    ]);
    return file("global", csv);
  }

  if (type === "project") {
    const id = url.searchParams.get("id") ?? "";
    const { data: p } = await supabase.from("projects").select("name").eq("id", id).eq("team_id", team.id).maybeSingle();
    if (!p) return new Response("Not found", { status: 404 });
    const rows = await fetchAll<ProjectDonor>((from, to) =>
      supabase.from("project_donors").select(DONOR_COLUMNS).eq("project_id", id).eq("team_id", team.id).order("added_at").range(from, to),
    );
    const csv = toCsv([
      [
        "Domain", "Date Added", "DR", "Keywords", "Traffic", "GEO", "Topics", "TF", "CF", "Price (G)",
        "From Global", "Core status", "Category Page", "Comm status", "Посередник", "Ціна (база)", "Діалог",
        "GP status", "Джерело", "Price", "Валюта", "Комісія %", "Реальна ціна", "Оплата",
        "Article URL", "Page URL", "Anchors", "Pre-anchor", "Перевірка посилання", "Гарантія до", "Published",
      ],
      ...rows.map((d) => {
        const g = d.global_donors;
        return [
          d.domain, d.added_at.slice(0, 10), g?.dr, g?.keywords, g?.traffic, g?.geo, g?.topics, g?.tf, g?.cf, g?.price,
          d.fg_status, d.core_status, d.category_page, d.comm_status, d.med_base, d.price_base, d.dialog,
          d.gp_status, d.gp_source, d.gp_price, d.gp_currency, d.gp_commission, d.gp_price == null ? "" : realCost(d).toFixed(2), d.pay_status,
          d.article_url, d.page_url, d.anchors, d.pre_anchor, d.link_status, d.guarantee_until, d.published_at?.slice(0, 10),
        ];
      }),
    ]);
    return file((p as { name: string }).name, csv);
  }

  return new Response("Unknown export type", { status: 400 });
}
