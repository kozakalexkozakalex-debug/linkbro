-- Outreach шаг 6: кампании — волна сделок проекта с общей целью, шаблоном письма и бюджетом.
create table if not exists public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  project_id uuid not null,
  name       text not null check (char_length(name) between 1 and 120),
  goal       integer not null default 0 check (goal >= 0),            -- сколько ссылок хотим
  budget     numeric(12,2) check (budget is null or budget >= 0),     -- бюджет волны
  currency   text not null default 'USD' check (currency in ('USD', 'EUR', 'UAH')),
  template   text not null default '' check (char_length(template) <= 8000),
  status     text not null default 'active' check (status in ('active', 'paused', 'done')),
  ends_on    date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, team_id) references public.projects (id, team_id) on delete cascade
);
create index if not exists campaigns_team_idx on public.campaigns (team_id, project_id, created_at desc);
drop trigger if exists campaigns_touch on public.campaigns;
create trigger campaigns_touch before update on public.campaigns for each row execute function public.touch_updated_at();

alter table public.project_donors add column if not exists campaign_id uuid references public.campaigns (id) on delete set null;
create index if not exists project_donors_campaign_idx on public.project_donors (campaign_id) where campaign_id is not null;

alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon;
grant select, insert, update, delete on public.campaigns to authenticated;
drop policy if exists campaigns_select on public.campaigns;
drop policy if exists campaigns_insert on public.campaigns;
drop policy if exists campaigns_update on public.campaigns;
drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated using (public.is_team_member(team_id));
create policy campaigns_insert on public.campaigns for insert to authenticated with check (public.is_team_member(team_id));
create policy campaigns_update on public.campaigns for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy campaigns_delete on public.campaigns for delete to authenticated using (public.is_team_member(team_id) and (created_by = auth.uid() or public.is_team_lead(team_id)));
