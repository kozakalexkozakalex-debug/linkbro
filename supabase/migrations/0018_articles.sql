-- Outreach шаг 4: статьи.
-- Кто пишет: ours — наш автор, publisher — пишет издатель, ready — у нас готовый текст.
alter table public.project_donors
  add column if not exists article_mode text not null default '' check (article_mode in ('', 'ours', 'publisher', 'ready'));

-- Статус статьи: + accepted (издатель принял текст)
alter table public.project_donors drop constraint if exists project_donors_article_status_check;
alter table public.project_donors add constraint project_donors_article_status_check
  check (article_status in ('', 'todo', 'writing', 'review', 'ready', 'sent', 'accepted'));

-- Версии и комментарии к статье сделки
create table if not exists public.article_notes (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  donor_id   uuid not null references public.project_donors (id) on delete cascade,
  kind       text not null default 'comment' check (kind in ('version', 'comment')),
  doc_url    text not null default '' check (char_length(doc_url) <= 1000),
  body       text not null default '' check (char_length(body) <= 4000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists article_notes_donor_idx on public.article_notes (donor_id, created_at desc);

alter table public.article_notes enable row level security;
revoke all on public.article_notes from anon;
grant select, insert, delete on public.article_notes to authenticated;
drop policy if exists article_notes_select on public.article_notes;
drop policy if exists article_notes_insert on public.article_notes;
drop policy if exists article_notes_delete on public.article_notes;
create policy article_notes_select on public.article_notes for select to authenticated using (public.is_team_member(team_id));
create policy article_notes_insert on public.article_notes for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid()
    and exists (select 1 from public.project_donors d where d.id = donor_id and d.team_id = article_notes.team_id));
create policy article_notes_delete on public.article_notes for delete to authenticated
  using (public.is_team_member(team_id) and (created_by = auth.uid() or public.is_team_lead(team_id)));
