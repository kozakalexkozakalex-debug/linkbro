-- Confero: свежесть и история метрик, Quality Score, сохранённые фильтры.

-- 1) Когда и откуда метрики
alter table public.global_donors
  add column if not exists metrics_at     timestamptz,
  add column if not exists metrics_source text not null default '' check (char_length(metrics_source) <= 40);
update public.global_donors set metrics_at = coalesce(checked_at, added_at)
  where metrics_at is null and (dr is not null or traffic is not null or keywords is not null or tf is not null or cf is not null);

-- 2) История значений: снимок при каждом изменении метрик (старые цифры не теряются)
create table if not exists public.metric_snapshots (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  donor_id   uuid not null references public.global_donors (id) on delete cascade,
  taken_at   timestamptz not null default now(),
  source     text not null default '',
  dr numeric, keywords numeric, traffic numeric, tf numeric, cf numeric
);
create index if not exists metric_snapshots_donor_idx on public.metric_snapshots (donor_id, taken_at desc);
alter table public.metric_snapshots enable row level security;
revoke all on public.metric_snapshots from anon;
grant select, insert, delete on public.metric_snapshots to authenticated;
drop policy if exists metric_snapshots_select on public.metric_snapshots;
drop policy if exists metric_snapshots_insert on public.metric_snapshots;
drop policy if exists metric_snapshots_delete on public.metric_snapshots;
create policy metric_snapshots_select on public.metric_snapshots for select to authenticated using (public.is_team_member(team_id));
create policy metric_snapshots_insert on public.metric_snapshots for insert to authenticated
  with check (public.is_team_member(team_id) and exists (select 1 from public.global_donors g where g.id = donor_id and g.team_id = metric_snapshots.team_id));
create policy metric_snapshots_delete on public.metric_snapshots for delete to authenticated using (public.is_team_lead(team_id));

-- Триггер: метрики изменились → дата обновления + снимок. Работает с правами того, кто меняет (RLS действует).
create or replace function public.track_metrics() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.dr is not null or new.traffic is not null or new.keywords is not null or new.tf is not null or new.cf is not null then
      new.metrics_at := coalesce(new.metrics_at, now());
    end if;
    return new;
  end if;
  if (new.dr, new.keywords, new.traffic, new.tf, new.cf) is distinct from (old.dr, old.keywords, old.traffic, old.tf, old.cf) then
    new.metrics_at := now();
    if (old.dr, old.keywords, old.traffic, old.tf, old.cf) is distinct from (null::numeric, null::numeric, null::numeric, null::numeric, null::numeric) then
      insert into public.metric_snapshots (team_id, donor_id, taken_at, source, dr, keywords, traffic, tf, cf)
      values (old.team_id, old.id, coalesce(old.metrics_at, old.added_at), old.metrics_source, old.dr, old.keywords, old.traffic, old.tf, old.cf);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists global_donors_track_metrics on public.global_donors;
create trigger global_donors_track_metrics before insert or update on public.global_donors for each row execute function public.track_metrics();

-- 3) Веса Quality Score для проекта (пусто = веса по умолчанию)
alter table public.projects add column if not exists score_weights jsonb not null default '{}'::jsonb;

-- 4) Сохранённые фильтры Confero (общие для команды)
create table if not exists public.saved_filters (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  params     text not null default '' check (char_length(params) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists saved_filters_team_idx on public.saved_filters (team_id, created_at);
alter table public.saved_filters enable row level security;
revoke all on public.saved_filters from anon;
grant select, insert, delete on public.saved_filters to authenticated;
drop policy if exists saved_filters_select on public.saved_filters;
drop policy if exists saved_filters_insert on public.saved_filters;
drop policy if exists saved_filters_delete on public.saved_filters;
create policy saved_filters_select on public.saved_filters for select to authenticated using (public.is_team_member(team_id));
create policy saved_filters_insert on public.saved_filters for insert to authenticated with check (public.is_team_member(team_id));
create policy saved_filters_delete on public.saved_filters for delete to authenticated using (public.is_team_member(team_id) and (created_by = auth.uid() or public.is_team_lead(team_id)));

-- 5) Представление Confero: + дата/источник метрик, Quality Score (веса по умолчанию) и полнота данных.
--    Score = взвешенное среднее нормированных метрик, отсутствующие метрики не тянут оценку вниз,
--    а уменьшают полноту (coverage). Формула та же, что в lib/score.ts.
create or replace view public.global_donors_usage with (security_invoker = true) as
select
  g.id, g.team_id, g.domain, g.price, g.batch, g.dr, g.keywords, g.traffic, g.geo, g.topics, g.tf, g.cf,
  g.status, g.checked_at, g.added_at,
  coalesce(u.projects, 0)::int as projects,
  coalesce(u.work, 0)::int     as work,
  coalesce(u.links, 0)::int    as links,
  g.metrics_at, g.metrics_source,
  case when s.w > 0 then round(100 * s.v / s.w)::int end as score,
  s.w::int as coverage
from public.global_donors g
left join lateral (
  select
    count(*) as projects,
    count(*) filter (where pd.fg_status = 'core' and pd.stage not in ('published', 'lost')) as work,
    count(*) filter (where pd.stage = 'published') as links
  from public.project_donors pd
  where pd.team_id = g.team_id and pd.domain = g.domain
) u on true
cross join lateral (
  select
    coalesce(case when g.dr is not null then 30 * least(greatest(g.dr, 0), 100) / 100.0 end, 0)
    + coalesce(case when g.traffic is not null then 30 * least(log(greatest(g.traffic, 1)) / 6.0, 1) end, 0)
    + coalesce(case when g.keywords is not null then 15 * least(log(greatest(g.keywords, 1)) / 5.0, 1) end, 0)
    + coalesce(case when g.tf is not null then 15 * least(greatest(g.tf, 0), 50) / 50.0 end, 0)
    + coalesce(case when g.tf is not null and g.cf > 0 then 10 * least(g.tf / g.cf, 1) end, 0) as v,
    (case when g.dr is not null then 30 else 0 end) + (case when g.traffic is not null then 30 else 0 end)
    + (case when g.keywords is not null then 15 else 0 end) + (case when g.tf is not null then 15 else 0 end)
    + (case when g.tf is not null and g.cf > 0 then 10 else 0 end) as w
) s;
revoke all on public.global_donors_usage from anon;
grant select on public.global_donors_usage to authenticated;
