// Проверка опубликованных ссылок по времени следующей проверки. Вызывается каждый час из GitHub Actions
// с секретом CRON_SECRET. За один вызов проверяет до 20 ссылок, остальные — следующими вызовами.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECK_COLS, checkAndSave, type CheckRow } from "@/lib/linkcheck-save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 20;
const PARALLEL = 5;


export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  // Пора проверять: новые (ещё не назначено) и те, у кого подошло время следующей проверки
  const due = `link_next_check_at.is.null,link_next_check_at.lte."${new Date().toISOString()}"`;

  const { data, error } = await db
    .from("project_donors")
    .select(CHECK_COLS)
    .neq("article_url", "")
    .or(due)
    .order("link_next_check_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []) as CheckRow[];
  let i = 0;
  const results: Record<string, number> = {};
  async function worker() {
    while (i < items.length) {
      const it = items[i++];
      const status = await checkAndSave(db, it);
      results[status] = (results[status] ?? 0) + 1;
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
