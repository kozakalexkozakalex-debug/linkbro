// Проверить ссылку, записать проверку в историю и обновить состояние — без ложных тревог.
//   ok                       → «На місці», следующая проверка через сутки
//   сбой (таймаут, 403, 5xx) → состояние не меняем, повтор через 6 ч; после 3 сбоев подряд — «Не вдалося перевірити»
//   отклонение (нет ссылки, nofollow, noindex, анкор, другой URL)
//       впервые               → «Під підозрою», повтор через 6 ч
//       то же второй раз      → подтверждено: состояние = проблема, дата проблемы, задача «повернути посилання»
// Общая логика для кнопки ↻, «Перевірити всі» и фоновой проверки.
import { checkLinkDetail } from "@/lib/linkcheck";

export const PROBLEM_STATUSES = ["missing", "nofollow", "noindex", "anchor", "target"];
const TECH = ["error", "blocked"];
export const CHECK_COLS =
  "id, team_id, article_url, page_url, anchors, link_status, link_problem_at, next_action_at, link_expected_rel, link_suspect, link_fail_count";
export const RESTORE_TASK = "повернути посилання (знято / nofollow)";
const HOUR = 3_600_000;

export type CheckRow = {
  id: string;
  team_id: string;
  article_url: string;
  page_url: string;
  anchors: string;
  link_status: string;
  link_problem_at: string | null;
  next_action_at: string | null;
  link_expected_rel?: string;
  link_suspect?: string;
  link_fail_count?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAndSave(db: any, row: CheckRow, taskText = RESTORE_TASK): Promise<string> {
  const r = await checkLinkDetail(row.article_url, row.page_url, row.anchors, { allowNofollow: row.link_expected_rel === "any" });
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const at = (h: number) => new Date(now.getTime() + h * HOUR).toISOString();

  // 1) История — всегда новая запись
  await db.from("link_checks").insert({
    team_id: row.team_id,
    donor_id: row.id,
    checked_at: now.toISOString(),
    url: row.article_url.slice(0, 1000),
    http_status: r.http,
    final_url: r.finalUrl.slice(0, 1000),
    found: r.found,
    found_href: r.href.slice(0, 1000),
    found_anchor: r.anchor.slice(0, 500),
    found_rel: r.rel.slice(0, 200),
    noindex: r.noindex,
    outcome: r.status,
    note: r.note.slice(0, 500),
    ms: r.ms,
  });

  // 2) Состояние
  const patch: Record<string, unknown> = { link_checked_at: now.toISOString(), link_note: r.note };
  const fails = Number(row.link_fail_count) || 0;
  let shown = r.status as string;

  if (r.status === "ok") {
    Object.assign(patch, { link_status: "ok", link_suspect: "", link_fail_count: 0, link_problem_at: null, link_next_check_at: at(24) });
  } else if (TECH.includes(r.status)) {
    // Техническая ошибка — не потеря ссылки
    const n = fails + 1;
    Object.assign(patch, { link_fail_count: n, link_next_check_at: at(n >= 3 ? 24 : 6) });
    if (n >= 3 || !row.link_status) patch.link_status = r.status;
    else shown = row.link_status;
  } else if (row.link_status === r.status) {
    // Уже подтверждённая проблема — без изменений
    Object.assign(patch, { link_fail_count: 0, link_suspect: "", link_next_check_at: at(24) });
  } else if (row.link_suspect === r.status) {
    // Второй раз подряд то же отклонение — подтверждаем
    Object.assign(patch, { link_status: r.status, link_suspect: "", link_fail_count: 0, link_problem_at: now.toISOString(), link_next_check_at: at(24) });
    if (!row.next_action_at || row.next_action_at > today) {
      patch.next_action_at = today;
      patch.next_action = taskText.slice(0, 200);
    }
  } else {
    // Впервые — подозрение, повтор через 6 часов
    Object.assign(patch, { link_status: "suspect", link_suspect: r.status, link_fail_count: 0, link_next_check_at: at(6) });
    shown = "suspect";
  }
  await db.from("project_donors").update(patch).eq("id", row.id);
  return shown;
}
