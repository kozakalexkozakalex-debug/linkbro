-- Общие шаблоны команды: письма/сообщения посредникам и ТЗ для авторов.
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       text not null check (kind in ('message', 'brief')),
  name       text not null check (char_length(name) between 1 and 120),
  body       text not null default '' check (char_length(body) <= 8000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_team_idx on public.templates (team_id, kind, name);
create trigger templates_touch before update on public.templates for each row execute function public.touch_updated_at();

alter table public.templates enable row level security;
revoke all on public.templates from anon;
grant select, insert, update, delete on public.templates to authenticated;
create policy templates_select on public.templates for select to authenticated using (public.is_team_member(team_id));
create policy templates_insert on public.templates for insert to authenticated with check (public.is_team_member(team_id));
create policy templates_update on public.templates for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy templates_delete on public.templates for delete to authenticated using (public.is_team_member(team_id));
