-- Outreach: автоматические последовательности писем (письмо 1 → напоминание через N дней → последнее через M дней).
-- Кампания = цепочка писем. Стоп при ответе, при «Погодили»/«Відсіяли», при недоставке, для контактов «не писати».
alter table public.campaigns
  add column if not exists subject     text not null default '' check (char_length(subject) <= 300),
  add column if not exists step2_days  integer not null default 3 check (step2_days between 1 and 60),
  add column if not exists step2_body  text not null default '' check (char_length(step2_body) <= 8000),
  add column if not exists step3_days  integer not null default 4 check (step3_days between 1 and 60),
  add column if not exists step3_body  text not null default '' check (char_length(step3_body) <= 8000),
  add column if not exists daily_limit integer not null default 50 check (daily_limit between 1 and 500),
  add column if not exists sender      uuid references auth.users (id) on delete set null;  -- чей ящик отправляет

-- Состояние цепочки у сделки (отдельно от этапа сделки)
alter table public.project_donors
  add column if not exists seq_campaign_id uuid references public.campaigns (id) on delete set null,
  add column if not exists seq_step        integer not null default 0,     -- сколько писем цепочки уже ушло
  add column if not exists seq_next_at     timestamptz,
  add column if not exists seq_status      text not null default '' check (seq_status in ('', 'running', 'replied', 'stopped', 'done', 'bounced', 'optout'));
create index if not exists project_donors_seq_due_idx on public.project_donors (seq_next_at) where seq_status = 'running';

-- Контакт просил не писать — никогда не попадает в рассылки
alter table public.contacts add column if not exists do_not_contact boolean not null default false;
