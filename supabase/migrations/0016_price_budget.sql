-- Outreach шаг 2: цена и бюджет.
-- offers: запись привязана к сделке и имеет тип — его цена / наша контрпропозиция / согласовано / доп. расходы.
-- История только добавляется (не перезаписывается). Старые записи остаются «его ценой» по домену.
alter table public.offers
  add column if not exists donor_id uuid references public.project_donors (id) on delete cascade,
  add column if not exists kind text not null default 'quote' check (kind in ('quote', 'counter', 'agreed', 'extra'));
create index if not exists offers_donor_idx on public.offers (donor_id, created_at desc) where donor_id is not null;

-- Лимит цены за одну ссылку в проекте (валюта — budget_currency проекта)
alter table public.projects
  add column if not exists link_budget numeric(12,2) check (link_budget is null or link_budget >= 0);

-- Доп. расходы по сделке (срочность, замена ссылки и т.п.) — входят в итоговую стоимость
alter table public.project_donors
  add column if not exists extra_cost numeric(12,2) not null default 0 check (extra_cost >= 0);

-- RLS на offers уже включён (0006): select/insert — участники команды, delete — тимлид.
