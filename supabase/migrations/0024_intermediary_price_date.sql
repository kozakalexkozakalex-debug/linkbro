-- Nexo: дата последнего изменения цены у сайта посредника (отдельно от любого другого изменения строки)
alter table public.intermediaries add column if not exists price_updated_at timestamptz;
update public.intermediaries set price_updated_at = updated_at where price <> '' and price_updated_at is null;

create or replace function public.intermediaries_price_date()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.price <> '' then new.price_updated_at := now(); end if;
  elsif new.price is distinct from old.price then
    new.price_updated_at := case when new.price <> '' then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists intermediaries_price_date on public.intermediaries;
create trigger intermediaries_price_date before insert or update on public.intermediaries
  for each row execute function public.intermediaries_price_date();
