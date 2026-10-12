-- =====================================================================
-- LinkBro · 0004
-- Профиль проекта: сайт клиента, GEO, язык, месячный бюджет на ссылки.
-- Запускать один раз в Supabase → SQL Editor, после 0003.
-- =====================================================================

alter table public.projects
  add column if not exists client_site     text    not null default '' check (char_length(client_site) <= 300),
  add column if not exists geo             text    not null default '' check (char_length(geo) <= 100),
  add column if not exists language        text    not null default '' check (char_length(language) <= 60),
  add column if not exists monthly_budget  numeric check (monthly_budget is null or monthly_budget >= 0),
  add column if not exists budget_currency text    not null default 'USD' check (budget_currency in ('USD', 'EUR', 'UAH'));
