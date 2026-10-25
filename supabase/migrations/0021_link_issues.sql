-- Моніторинг шаг 3: проблемы со ссылками — отдельно от проверок.
-- Виявлено (первое отклонение) → Підтверджено (второй раз подряд) → В роботі → Вирішено / Хибна тривога.
create table if not exists public.link_issues (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  donor_id     uuid not null references public.project_donors (id) on delete cascade,
  project_id   uuid not null,
  type         text not null check (type in ('missing', 'nofollow', 'noindex', 'anchor', 'target')),
  severity     text not null default 'medium' check (severity in ('high', 'medium', 'low')),
  status       text not null default 'detected' check (status in ('detected', 'confirmed', 'in_progress', 'resolved', 'false_positive')),
  detected_at  timestamptz not null default now(),
  confirmed_at timestamptz,
  resolved_at  timestamptz,
  assignee     uuid references auth.users (id) on delete set null,
  due_date     date,
  resolution   text not null default '' check (char_length(resolution) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (project_id, team_id) references public.projects (id, team_id) on delete cascade
);
-- Одна открытая проблема на размещение
create unique index if not exists link_issues_open_uidx on public.link_issues (donor_id) where status in ('detected', 'confirmed', 'in_progress');
create index if not exists link_issues_team_idx on public.link_issues (team_id, status, detected_at desc);
drop trigger if exists link_issues_touch on public.link_issues;
create trigger link_issues_touch before update on public.link_issues for each row execute function public.touch_updated_at();

alter table public.link_issues enable row level security;
revoke all on public.link_issues from anon;
grant select, insert, update, delete on public.link_issues to authenticated;
drop policy if exists link_issues_select on public.link_issues;
drop policy if exists link_issues_insert on public.link_issues;
drop policy if exists link_issues_update on public.link_issues;
drop policy if exists link_issues_delete on public.link_issues;
create policy link_issues_select on public.link_issues for select to authenticated using (public.is_team_member(team_id));
create policy link_issues_insert on public.link_issues for insert to authenticated
  with check (public.is_team_member(team_id) and exists (select 1 from public.project_donors d where d.id = donor_id and d.team_id = link_issues.team_id));
create policy link_issues_update on public.link_issues for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy link_issues_delete on public.link_issues for delete to authenticated using (public.is_team_lead(team_id));

-- Текущие подтверждённые проблемы → открытые записи (чтобы список не начинался пустым)
insert into public.link_issues (team_id, donor_id, project_id, type, severity, status, detected_at, confirmed_at, assignee)
select d.team_id, d.id, d.project_id, d.link_status,
  case when d.link_status = 'missing' or (d.guarantee_until is not null and d.guarantee_until >= current_date) then 'high'
       when d.link_status = 'anchor' then 'low' else 'medium' end,
  'confirmed', coalesce(d.link_problem_at, now()), coalesce(d.link_problem_at, now()), d.assignee
from public.project_donors d
where d.link_status in ('missing', 'nofollow', 'noindex', 'anchor', 'target')
on conflict do nothing;
