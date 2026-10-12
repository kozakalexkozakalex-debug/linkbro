// Ежедневная проверка опубликованных ссылок. Вызывается по расписанию из GitHub Actions
// с секретом CRON_SECRET. За один вызов проверяет до 20 ссылок, остальные — следующими вызовами.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLink } from "@/lib/linkcheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 20;
const PARALLEL = 5;

type Item = { id: string; article_url: string; page_url: string; anchors: string };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const due = `link_checked_at.is.null,link_checked_at.lt.${cutoff}`;

  const { data, error } = await db
    .from("project_donors")
    .select("id, article_url, page_url, anchors")
    .neq("article_url", "")
    .or(due)
    .order("link_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []) as Item[];
  let i = 0;
  const results: Record<string, number> = {};
  async function worker() {
    while (i < items.length) {
      const it = items[i++];
      const r = await checkLink(it.article_url, it.page_url, it.anchors);
      results[r.status] = (results[r.status] ?? 0) + 1;
      await db
        .from("project_donors")
        .update({ link_status: r.status, link_note: r.note, link_checked_at: new Date().toISOString() })
        .eq("id", it.id);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const { count } = await db
    .from("project_donors")
    .select("id", { count: "exact", head: true })
    .neq("article_url", "")
    .or(due);

  return NextResponse.json({ checked: items.length, results, remaining: count ?? 0 });
}
