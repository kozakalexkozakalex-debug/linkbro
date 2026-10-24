-- Этап 1: посредники с каналами связи, цены с историей, лента переписки, следующий шаг и статья в сделке.

-- ---------- Контакты: посредник, владелец сайта или биржа. handle — то, что пишется в колонке «Посередник» ----------
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  handle     text not null check (char_length(handle) between 1 and 300),
  kind       text not null default 'intermediary' check (kind in ('intermediary', 'owner', 'exchange')),
  name       text not null default '',
  email      text not null default '',
  telegram   text not null default '',
  whatsapp   text not null default '',
  other      text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, handle)
);
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

-- ---------- Цены: кто и почём продаёт домен. Записи только добавляются — это история цен ----------
create table public.offers (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  domain     text not null check (domain = lower(domain) and char_length(domain) between 1 and 253),
  handle     text not null default '',
  price      numeric(12,2) not null check (price >= 0),
  currency   text not null default 'USD' check (currency in ('USD', 'EUR', 'UAH')),
  note       text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index offers_domain_idx on public.offers (team_id, domain, created_at desc);
create index offers_handle_idx on public.offers (team_id, handle);

-- ---------- Лента переписки и действий по сделке ----------
create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  donor_id   uuid references public.project_donors (id) on delete cascade,
  handle     text not null default '',
  channel    text not null default 'note' check (channel in ('email', 'telegram', 'whatsapp', 'exchange', 'call', 'note')),
  body       text not null default '' check (char_length(body) <= 4000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index activities_donor_idx on public.activities (donor_id, created_at desc);
create index activities_handle_idx on public.activities (team_id, handle, created_at desc);

-- ---------- Сделка: следующий шаг, ссылка на заказ биржи, статья ----------
alter table public.project_donors
  add column if not exists next_action_at  date,
  add column if not exists next_action     text not null default '',
  add column if not exists exchange_url    text not null default '',
  add column if not exists article_writer  text not null default '',
  add column if not exists article_doc     text not null default '',
  add column if not exists article_deadline date,
  add column if not exists article_status  text not null default '' check (article_status in ('', 'todo', 'writing', 'review', 'ready', 'sent'));
create index if not exists project_donors_next_idx on public.project_donors (team_id, next_action_at) where next_action_at is not null;

-- ---------- Доступ: только своя команда ----------
alter table public.contacts   enable row level security;
alter table public.offers     enable row level security;
alter table public.activities enable row level security;

revoke all on public.contacts, public.offers, public.activities from anon;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, delete on public.offers to authenticated;
grant select, insert, update, delete on public.activities to authenticated;

create policy contacts_select on public.contacts for select to authenticated using (public.is_team_member(team_id));
create policy contacts_insert on public.contacts for insert to authenticated with check (public.is_team_member(team_id));
create policy contacts_update on public.contacts for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy contacts_delete on public.contacts for delete to authenticated using (public.is_team_lead(team_id));

create policy offers_select on public.offers for select to authenticated using (public.is_team_member(team_id));
create policy offers_insert on public.offers for insert to authenticated with check (public.is_team_member(team_id));
create policy offers_delete on public.offers for delete to authenticated using (public.is_team_lead(team_id));

create policy activities_select on public.activities for select to authenticated using (public.is_team_member(team_id));
create policy activities_insert on public.activities for insert to authenticated with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy activities_update on public.activities for update to authenticated using (public.is_team_member(team_id) and created_by = auth.uid()) with check (public.is_team_member(team_id));
create policy activities_delete on public.activities for delete to authenticated using (public.is_team_member(team_id) and (created_by = auth.uid() or public.is_team_lead(team_id)));

-- ---------- Перенос существующих данных ----------
insert into public.contacts (team_id, handle, email)
select distinct team_id, trim(intermediary), case when trim(intermediary) ~ '^[^@\s]+@[^@\s]+$' then trim(intermediary) else '' end
from public.intermediaries where trim(intermediary) <> ''
on conflict (team_id, handle) do nothing;

insert into public.contacts (team_id, handle, email)
select distinct team_id, trim(med_base), case when trim(med_base) ~ '^[^@\s]+@[^@\s]+$' then trim(med_base) else '' end
from public.project_donors where trim(med_base) <> ''
on conflict (team_id, handle) do nothing;

insert into public.offers (team_id, domain, handle, price, created_by)
select team_id, domain, trim(intermediary), nullif(regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g'), '')::numeric, null
from public.intermediaries
where trim(intermediary) <> '' and regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$';
