// Проверить ссылку и сохранить результат. Общая логика для кнопки ↻, «Перевірити всі» и ежедневной проверки.
// Ссылка была в порядке, а стала проблемной → дата проблемы + задача «повернути посилання» на сегодня
// (попадает в Outreach → «Нагадати» → «За планом»).
import { checkLink } from "@/lib/linkcheck";

export const PROBLEM_STATUSES = ["missing", "nofollow", "noindex", "anchor"];
export const CHECK_COLS = "id, article_url, page_url, anchors, link_status, link_problem_at, next_action_at";
export const RESTORE_TASK = "повернути посилання (знято / nofollow)";

export type CheckRow = {
  id: string;
  article_url: string;
  page_url: string;
  anchors: string;
  link_status: string;
  link_problem_at: string | null;
  next_action_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAndSave(db: any, row: CheckRow, taskText = RESTORE_TASK): Promise<string> {
  const r = await checkLink(row.article_url, row.page_url, row.anchors);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { link_status: r.status, link_note: r.note, link_checked_at: now.toISOString() };
  const wasProblem = PROBLEM_STATUSES.includes(row.link_status);
  if (PROBLEM_STATUSES.includes(r.status)) {
    if (!wasProblem || !row.link_problem_at) patch.link_problem_at = now.toISOString();
    if (!wasProblem && (!row.next_action_at || row.next_action_at > today)) {
      patch.next_action_at = today;
      patch.next_action = taskText.slice(0, 200);
    }
  } else if (r.status === "ok") {
    patch.link_problem_at = null;
  }
  await db.from("project_donors").update(patch).eq("id", row.id);
  return r.status;
}
