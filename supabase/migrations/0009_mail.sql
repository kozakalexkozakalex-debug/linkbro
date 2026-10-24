-- Почта в приложении: ящик пользователя (IMAP/SMTP, пароль приложения хранится зашифрованным)
-- и входящие/исходящие письма в ленте переписки.

create table public.mail_accounts (
  user_id      uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  email        text not null check (char_length(email) between 3 and 300),
  imap_host    text not null,
  imap_port    int  not null default 993,
  smtp_host    text not null,
  smtp_port    int  not null default 465,
  secret       text not null,              -- пароль приложения, зашифрован ключом MAIL_SECRET_KEY (только сервер)
  last_uid     bigint not null default 0,
  last_sync_at timestamptz,
  last_error   text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.mail_accounts enable row level security;
revoke all on public.mail_accounts from anon;
grant select, insert, update, delete on public.mail_accounts to authenticated;
-- Ящик видит и меняет только его владелец
create policy mail_select on public.mail_accounts for select to authenticated using (user_id = auth.uid());
create policy mail_insert on public.mail_accounts for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy mail_update on public.mail_accounts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy mail_delete on public.mail_accounts for delete to authenticated using (user_id = auth.uid());

-- Письма в ленте
alter table public.activities
  add column if not exists direction  text not null default 'out' check (direction in ('in', 'out')),
  add column if not exists subject    text not null default '' check (char_length(subject) <= 500),
  add column if not exists message_id text not null default '',
  add column if not exists is_read    boolean not null default true;
create unique index if not exists activities_msg_uidx on public.activities (team_id, donor_id, message_id) where message_id <> '';
create index if not exists activities_unread_idx on public.activities (team_id, is_read) where is_read = false;

-- Входящие письма записывает фоновая синхронизация от имени владельца ящика
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated with check (public.is_team_member(team_id) and created_by = auth.uid());
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
