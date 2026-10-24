-- Confero: где домен уже используется — в скольких проектах, в работе ли, есть ли наш опубликованный линк.
-- Представление с security_invoker: видит ровно то, что разрешают политики RLS исходных таблиц (только своя команда).
create index if not exists project_donors_team_domain_idx on public.project_donors (team_id, domain);

create or replace view public.global_donors_usage with (security_invoker = true) as
select
  g.id, g.team_id, g.domain, g.price, g.batch, g.dr, g.keywords, g.traffic, g.geo, g.topics, g.tf, g.cf,
  g.status, g.checked_at, g.added_at,
  coalesce(u.projects, 0)::int as projects,
  coalesce(u.work, 0)::int     as work,
  coalesce(u.links, 0)::int    as links
from public.global_donors g
left join lateral (
  select
    count(*) as projects,
    count(*) filter (where pd.fg_status = 'core' and pd.stage not in ('published', 'lost')) as work,
    count(*) filter (where pd.stage = 'published') as links
  from public.project_donors pd
  where pd.team_id = g.team_id and pd.domain = g.domain
) u on true;

revoke all on public.global_donors_usage from anon;
grant select on public.global_donors_usage to authenticated;
