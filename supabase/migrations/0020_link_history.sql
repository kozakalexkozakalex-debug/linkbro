-- Моніторинг шаги 1–2: история проверок и «без ложных тревог».
-- link_checks — каждая проверка отдельной записью (не перезаписываем).
create table if not exists public.link_checks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  donor_id     uuid not null references public.project_donors (id) on delete cascade,
  checked_at   timestamptz not null default now(),
  url          text not null default '',
  http_status  integer,
  final_url    text not null default '',
  found        boolean not null default false,
  found_href   text not null default '',
  found_anchor text not null default '',
  found_rel    text not null default '',
  noindex      boolean not null default false,
  outcome      text not null default '',   -- ok / missing / nofollow / noindex / anchor / target / error / blocked
  note         text not null default '',
  ms           integer
);
create index if not exists link_checks_donor_idx on public.link_checks (donor_id, checked_at desc);

alter table public.link_checks enable row level security;
revoke all on public.link_checks from anon;
grant select, insert, delete on public.link_checks to authenticated;
drop policy if exists link_checks_select on public.link_checks;
drop policy if exists link_checks_insert on public.link_checks;
drop policy if exists link_checks_delete on public.link_checks;
create policy link_checks_select on public.link_checks for select to authenticated using (public.is_team_member(team_id));
create policy link_checks_insert on public.link_checks for insert to authenticated
  with check (public.is_team_member(team_id) and exists (select 1 from public.project_donors d where d.id = donor_id and d.team_id = link_checks.team_id));
create policy link_checks_delete on public.link_checks for delete to authenticated using (public.is_team_lead(team_id));

-- Состояние размещения: ожидаемый тип ссылки, подозрение до подтверждения, счётчик технических сбоев, следующая проверка
alter table public.project_donors
  add column if not exists link_expected_rel text not null default 'dofollow' check (link_expected_rel in ('dofollow', 'any')),
  add column if not exists link_suspect      text not null default '',
  add column if not exists link_fail_count   integer not null default 0,
  add column if not exists link_next_check_at timestamptz;

alter table public.project_donors drop constraint if exists project_donors_link_status_check;
alter table public.project_donors add constraint project_donors_link_status_check
  check (link_status in ('', 'ok', 'missing', 'nofollow', 'noindex', 'anchor', 'target', 'suspect', 'error', 'blocked'));
create index if not exists project_donors_next_check_idx on public.project_donors (link_next_check_at) where article_url <> '';
