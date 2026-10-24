-- Моніторинг: с какого момента у ссылки проблема (снята / nofollow / noindex / другой анкор).
-- Ставится при переходе «было ок → проблема», очищается, когда ссылка снова на месте. Новых таблиц нет.
alter table public.project_donors add column if not exists link_problem_at timestamptz;
update public.project_donors
  set link_problem_at = coalesce(link_checked_at, now())
  where link_status in ('missing', 'nofollow', 'noindex', 'anchor') and link_problem_at is null;
