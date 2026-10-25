-- Outreach шаг 3: одно письмо посреднику сразу по нескольким доменам.
-- Письмо хранится ОДИН раз; donor_ids — все сделки, к которым оно относится (без копий в каждой сделке).
-- donor_id остаётся для писем по одной сделке. RLS таблицы activities не меняется (только своя команда).
alter table public.activities add column if not exists donor_ids uuid[] not null default '{}';
create index if not exists activities_donor_ids_idx on public.activities using gin (donor_ids);
