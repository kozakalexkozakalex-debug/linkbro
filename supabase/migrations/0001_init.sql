-- =====================================================================
-- LinkBro · 0001_init
-- Базовая структура: команды, участники, проекты, доноры, посредники,
-- свои статусы, таски. На КАЖДОЙ таблице включён RLS: человек видит
-- только данные команд, в которых состоит.
-- Запускать один раз в Supabase → SQL Editor.
-- =====================================================================

-- ---------- Профили пользователей (имя и почта для списка команды) ----------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

-- ---------- Команды ----------
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'builder' check (role in ('lead', 'builder')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

-- Приглашения в команду по ссылке (одноразовые, живут 7 дней)
create table public.team_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role       text not null default 'builder' check (role in ('lead', 'builder')),
  created_by uuid not null default auth.uid() references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users (id),
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index team_invites_team_idx on public.team_invites (team_id);

-- ---------- Проекты ----------
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 100),
  plan_per_month integer not null default 0 check (plan_per_month >= 0),
  requirements   text not null default '',
  notes          text not null default '',
  -- фильтр метрик проекта: {"dr":{"min":20,"max":null}, "kw":..., "traffic":..., "tf":..., "cf":..., "ratio":...}
  metric_filter  jsonb not null default '{}'::jsonb,
  created_by     uuid default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, team_id)
);
create index projects_team_idx on public.projects (team_id);

-- Стоп-листы проекта: 'tools' — из Ahrefs/GSC/Majestic, 'global' — уже приходили из глобала
create table public.project_stoplist (
  project_id uuid not null,
  team_id    uuid not null,
  domain     text not null check (domain = lower(domain) and char_length(domain) between 1 and 253),
  source     text not null check (source in ('tools', 'global')),
  created_at timestamptz not null default now(),
  primary key (project_id, source, domain),
  foreign key (project_id, team_id) references public.projects (id, team_id) on delete cascade
);
create index project_stoplist_team_idx on public.project_stoplist (team_id);

-- ---------- Глобальная база доноров (общая на команду) ----------
create table public.global_donors (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  domain     text not null check (domain = lower(domain) and char_length(domain) between 1 and 253),
  price      text not null default '',          -- например "PRnews 1500"
  batch      integer not null default 1,        -- номер итерации инпута (для чередования цвета даты)
  dr         numeric,
  keywords   numeric,
  traffic    numeric,
  geo        text not null default '',
  topics     text not null default '',
  tf         numeric,
  cf         numeric,
  status     text not null default 'new' check (status in ('new', 'fit', 'drop')),
  checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  added_at   timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, domain)
);

-- ---------- Доноры в проекте: все модули воронки в одной строке ----------
create table public.project_donors (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null,
  project_id     uuid not null,
  domain         text not null,
  assignee       uuid references auth.users (id) on delete set null,   -- ответственный линкбилдер
  added_at       timestamptz not null default now(),

  -- From Global
  fg_status      text not null default 'new' check (fg_status in ('new', 'core', 'out')),

  -- Project Core
  core_status    text not null default 'new_core',
  published_at   timestamptz,
  category_page  text not null default '',

  -- Communication
  in_comm        boolean not null default false,
  med_base       text not null default '',
  med_add        text not null default '',
  price_base     text not null default '',
  price_add      text not null default '',
  indicator      text check (indicator in ('sent', 'waiting', 'replied')),
  indicator_at   timestamptz,
  comm_status    text not null default '',
  dialog         text not null default '',

  -- Guest Posting
  in_gp          boolean not null default false,
  gp_med         text not null default '',
  gp_price       numeric,
  payments       text not null default '',
  article_link   text not null default '',
  page_url       text not null default '',
  anchors        text not null default '',
  pre_anchor     text not null default '',
  article_url    text not null default '',
  gp_status      text not null default '',

  updated_at     timestamptz not null default now(),
  unique (project_id, domain),
  foreign key (project_id, team_id) references public.projects (id, team_id) on delete cascade,
  foreign key (team_id, domain) references public.global_donors (team_id, domain) on delete cascade
);
create index project_donors_team_idx on public.project_donors (team_id);
create index project_donors_assignee_idx on public.project_donors (assignee);

-- ---------- База посредников (общая на команду) ----------
create table public.intermediaries (
  team_id      uuid not null references public.teams (id) on delete cascade,
  domain       text not null check (domain = lower(domain) and char_length(domain) between 1 and 253),
  intermediary text not null default '',
  price        text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (team_id, domain)
);

-- ---------- Свои статусы команды (добавляются к стандартным из кода) ----------
create table public.custom_statuses (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  kind       text not null check (kind in ('core_pos', 'core_neg', 'comm')),
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (team_id, kind, name)
);

-- ---------- Таски ----------
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  project_id uuid,
  assignee   uuid references auth.users (id) on delete set null,
  text       text not null check (char_length(text) between 1 and 1000),
  status     text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (project_id, team_id) references public.projects (id, team_id) on delete cascade
);
create index tasks_team_idx on public.tasks (team_id);

-- =====================================================================
-- Служебные функции
-- =====================================================================

-- Состоит ли текущий пользователь в команде
create function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = (select auth.uid())
  );
$$;

-- Является ли текущий пользователь тимлидом команды
create function public.is_team_lead(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = (select auth.uid()) and m.role = 'lead'
  );
$$;

-- Есть ли у текущего пользователя общая команда с другим пользователем
create function public.shares_team_with(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- Создать команду: создатель сразу становится тимлидом
create function public.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'Потрібно увійти в акаунт';
  end if;
  insert into public.teams (name, created_by) values (trim(p_name), v_uid) returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, v_uid, 'lead');
  return v_team;
end;
$$;

-- Принять приглашение по токену из ссылки
create function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.team_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Потрібно увійти в акаунт';
  end if;
  select * into v_inv from public.team_invites
   where token = p_token and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'Запрошення недійсне або вже використане';
  end if;
  insert into public.team_members (team_id, user_id, role)
  values (v_inv.team_id, v_uid, v_inv.role)
  on conflict (team_id, user_id) do nothing;
  update public.team_invites set used_by = v_uid, used_at = now() where id = v_inv.id;
  return v_inv.team_id;
end;
$$;

-- Автоматически создавать профиль при регистрации
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для тех, кто уже зарегистрировался до этой миграции
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Обновлять updated_at при каждом изменении строки
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch       before update on public.projects       for each row execute function public.touch_updated_at();
create trigger global_donors_touch  before update on public.global_donors  for each row execute function public.touch_updated_at();
create trigger project_donors_touch before update on public.project_donors for each row execute function public.touch_updated_at();
create trigger intermediaries_touch before update on public.intermediaries for each row execute function public.touch_updated_at();

-- Функции вызываются только вошедшими пользователями
revoke all on function public.is_team_member(uuid)   from public, anon;
revoke all on function public.is_team_lead(uuid)     from public, anon;
revoke all on function public.shares_team_with(uuid) from public, anon;
revoke all on function public.create_team(text)      from public, anon;
revoke all on function public.accept_invite(text)    from public, anon;
revoke all on function public.handle_new_user()      from public, anon, authenticated;
grant execute on function public.is_team_member(uuid)   to authenticated;
grant execute on function public.is_team_lead(uuid)     to authenticated;
grant execute on function public.shares_team_with(uuid) to authenticated;
grant execute on function public.create_team(text)      to authenticated;
grant execute on function public.accept_invite(text)    to authenticated;

-- =====================================================================
-- Row Level Security: включён на каждой таблице
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.team_invites     enable row level security;
alter table public.projects         enable row level security;
alter table public.project_stoplist enable row level security;
alter table public.global_donors    enable row level security;
alter table public.project_donors   enable row level security;
alter table public.intermediaries   enable row level security;
alter table public.custom_statuses  enable row level security;
alter table public.tasks            enable row level security;

-- Гости (не вошедшие) не получают доступа ни к одной таблице
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- profiles: видишь себя и коллег по командам, меняешь только себя
create policy "profiles: читать себя и коллег" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.shares_team_with(id)));
create policy "profiles: менять себя" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- teams: видят участники, меняет и удаляет тимлид. Создание — через create_team()
create policy "teams: читать участникам" on public.teams
  for select to authenticated using ((select public.is_team_member(id)));
create policy "teams: менять тимлиду" on public.teams
  for update to authenticated
  using ((select public.is_team_lead(id))) with check ((select public.is_team_lead(id)));
create policy "teams: удалять тимлиду" on public.teams
  for delete to authenticated using ((select public.is_team_lead(id)));

-- team_members: состав видят участники, управляет тимлид. Вступление — через accept_invite()
create policy "members: читать участникам" on public.team_members
  for select to authenticated using ((select public.is_team_member(team_id)));
create policy "members: добавлять тимлиду" on public.team_members
  for insert to authenticated with check ((select public.is_team_lead(team_id)));
create policy "members: менять роль тимлиду" on public.team_members
  for update to authenticated
  using ((select public.is_team_lead(team_id))) with check ((select public.is_team_lead(team_id)));
create policy "members: удалять тимлиду или выйти" on public.team_members
  for delete to authenticated
  using ((select public.is_team_lead(team_id)) or user_id = (select auth.uid()));

-- team_invites: только тимлид
create policy "invites: тимлид читает" on public.team_invites
  for select to authenticated using ((select public.is_team_lead(team_id)));
create policy "invites: тимлид создаёт" on public.team_invites
  for insert to authenticated
  with check ((select public.is_team_lead(team_id)) and created_by = (select auth.uid()));
create policy "invites: тимлид удаляет" on public.team_invites
  for delete to authenticated using ((select public.is_team_lead(team_id)));

-- projects: видят все участники, создаёт/меняет/удаляет тимлид
create policy "projects: читать участникам" on public.projects
  for select to authenticated using ((select public.is_team_member(team_id)));
create policy "projects: создавать тимлиду" on public.projects
  for insert to authenticated with check ((select public.is_team_lead(team_id)));
create policy "projects: менять тимлиду" on public.projects
  for update to authenticated
  using ((select public.is_team_lead(team_id))) with check ((select public.is_team_lead(team_id)));
create policy "projects: удалять тимлиду" on public.projects
  for delete to authenticated using ((select public.is_team_lead(team_id)));

-- Рабочие таблицы: участники читают, добавляют и меняют, удаляет только тимлид
do $$
declare t text;
begin
  foreach t in array array['project_stoplist','global_donors','project_donors','intermediaries','custom_statuses','tasks']
  loop
    execute format('create policy "%1$s: читать участникам" on public.%1$I for select to authenticated using ((select public.is_team_member(team_id)))', t);
    execute format('create policy "%1$s: добавлять участникам" on public.%1$I for insert to authenticated with check ((select public.is_team_member(team_id)))', t);
    execute format('create policy "%1$s: менять участникам" on public.%1$I for update to authenticated using ((select public.is_team_member(team_id))) with check ((select public.is_team_member(team_id)))', t);
    execute format('create policy "%1$s: удалять тимлиду" on public.%1$I for delete to authenticated using ((select public.is_team_lead(team_id)))', t);
  end loop;
end;
$$;
