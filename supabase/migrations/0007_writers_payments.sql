-- Этап 2: база авторов, заказ статьи в сделке (автор, стоимость, ТЗ), реестр выплат.

create table public.writers (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  contact    text not null default '',
  rate       numeric(12,2),
  rate_unit  text not null default 'article' check (rate_unit in ('article', '1000chars', '1000words')),
  currency   text not null default 'USD' check (currency in ('USD', 'EUR', 'UAH')),
  languages  text not null default '',
  niches     text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, name)
);
create trigger writers_touch before update on public.writers for each row execute function public.touch_updated_at();

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  donor_id   uuid references public.project_donors (id) on delete set null,
  payee_kind text not null default 'writer' check (payee_kind in ('intermediary', 'writer', 'exchange', 'other')),
  payee      text not null default '' check (char_length(payee) <= 300),
  amount     numeric(12,2) not null check (amount >= 0),
  currency   text not null default 'USD' check (currency in ('USD', 'EUR', 'UAH')),
  status     text not null default 'due' check (status in ('due', 'paid')),
  paid_at    timestamptz,
  note       text not null default '' check (char_length(note) <= 1000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index payments_team_idx on public.payments (team_id, status, created_at desc);

alter table public.project_donors
  add column if not exists writer_id    uuid references public.writers (id) on delete set null,
  add column if not exists article_cost numeric(12,2),
  add column if not exists brief        text not null default '' check (char_length(brief) <= 8000);

alter table public.writers  enable row level security;
alter table public.payments enable row level security;
revoke all on public.writers, public.payments from anon;
grant select, insert, update, delete on public.writers, public.payments to authenticated;

create policy writers_select on public.writers for select to authenticated using (public.is_team_member(team_id));
create policy writers_insert on public.writers for insert to authenticated with check (public.is_team_member(team_id));
create policy writers_update on public.writers for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy writers_delete on public.writers for delete to authenticated using (public.is_team_lead(team_id));

create policy payments_select on public.payments for select to authenticated using (public.is_team_member(team_id));
create policy payments_insert on public.payments for insert to authenticated with check (public.is_team_member(team_id));
create policy payments_update on public.payments for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy payments_delete on public.payments for delete to authenticated using (public.is_team_lead(team_id));
