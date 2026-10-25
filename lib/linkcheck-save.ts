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
  "id, team_id, project_id, assignee, guarantee_until, article_url, page_url, anchors, link_status, link_problem_at, next_action_at, link_expected_rel, link_suspect, link_fail_count";
export const RESTORE_TASK = "повернути посилання (знято / nofollow)";
const HOUR = 3_600_000;

export type CheckRow = {
  id: string;
  team_id: string;
  project_id?: string;
  assignee?: string | null;
  guarantee_until?: string | null;
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

  // 3) Проблема: виявлено → підтверджено; ссылка вернулась → вирішено (или хибна тривога, если не подтвердилась)
  try {
    await syncIssue(db, row, r.status, patch, now);
  } catch {
    /* список проблем не должен ломать саму проверку */
  }
  return shown;
}

export function severityOf(type: string, guaranteeUntil?: string | null): "high" | "medium" | "low" {
  if (type === "missing") return "high";
  if (guaranteeUntil && guaranteeUntil >= new Date().toISOString().slice(0, 10)) return "high";
  return type === "anchor" ? "low" : "medium";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncIssue(db: any, row: CheckRow, outcome: string, patch: Record<string, unknown>, now: Date) {
  if (!row.project_id) return;
  const { data } = await db.from("link_issues").select("id, status").eq("donor_id", row.id).in("status", ["detected", "confirmed", "in_progress"]).limit(1);
  const open = ((data ?? []) as { id: string; status: string }[])[0];
  const iso = now.toISOString();
  if (outcome === "ok") {
    if (open)
      await db
        .from("link_issues")
        .update(open.status === "detected" ? { status: "false_positive", resolved_at: iso, resolution: "не підтвердилось при повторній перевірці" } : { status: "resolved", resolved_at: iso, resolution: "посилання відновлено (перевірка)" })
        .eq("id", open.id);
    return;
  }
  if (!PROBLEM_STATUSES.includes(outcome)) return; // технические сбои — не проблема
  const confirmed = patch.link_status === outcome || row.link_status === outcome; // подтверждено этой или прошлой проверкой
  const base = { type: outcome, severity: severityOf(outcome, row.guarantee_until) };
  if (!open) {
    await db.from("link_issues").insert({
      team_id: row.team_id,
      donor_id: row.id,
      project_id: row.project_id,
      ...base,
      status: confirmed ? "confirmed" : "detected",
      detected_at: iso,
      confirmed_at: confirmed ? iso : null,
      assignee: row.assignee ?? null,
      due_date: confirmed ? new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10) : null,
    });
  } else if (open.status === "detected" && confirmed) {
    await db
      .from("link_issues")
      .update({ ...base, status: "confirmed", confirmed_at: iso, assignee: row.assignee ?? null, due_date: new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10) })
      .eq("id", open.id);
  }
}
