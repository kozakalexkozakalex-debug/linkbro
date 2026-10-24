-- Свои доски у модулей проекта.
-- Домени (пул): new → check → ok (запас) → core (в работу) / out (отсеяно, с причиной).
-- Outreach: явный этап stage (много статусов, включая статью). core_status и indicator остаются
-- для старой логики и отчётов и синхронизируются триггером в обе стороны.

alter table public.project_donors drop constraint if exists project_donors_fg_status_check;
alter table public.project_donors add constraint project_donors_fg_status_check check (fg_status in ('new', 'check', 'ok', 'core', 'out'));
alter table public.project_donors add column if not exists reject_reason text not null default '' check (char_length(reject_reason) <= 200);

alter table public.project_donors add column if not exists stage text not null default 'find'
  check (stage in ('find', 'contacted', 'replied', 'negotiating', 'agreed', 'writing', 'review', 'sent', 'paid', 'published', 'lost'));

-- Этап из старых полей
create or replace function public.stage_from(p_core text, p_ind text) returns text language sql immutable as $$
  select case
    when p_core in ('Low_metrics', 'Bad_Cat', 'Over_priced', 'Poor_Article', 'No_Index') then 'lost'
    when p_core = 'Published' then 'published'
    when p_core = 'Paid' then 'paid'
    when p_core = 'Sent_article' then 'sent'
    when p_core in ('Price_ok', 'client_OK') then 'agreed'
    when p_ind = 'replied' then 'replied'
    when p_ind in ('sent', 'waiting') then 'contacted'
    else 'find'
  end
$$;

-- «Семья» этапа: внутри семьи тонкий статус не перетирается грубым (Торгуємося остаётся, пока не сменилась семья)
create or replace function public.stage_family(p text) returns text language sql immutable as $$
  select case
    when p in ('replied', 'negotiating') then 'replied'
    when p in ('writing', 'review', 'sent') then 'article'
    else p
  end
$$;

create or replace function public.sync_stage() returns trigger language plpgsql as $$
declare d text;
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    -- этап поменяли явно → подтягиваем старые поля
    new.core_status := case new.stage
      when 'find' then case when new.core_status in ('new_core', 'OK_Cat') then new.core_status else 'new_core' end
      when 'contacted' then 'In communication'
      when 'replied' then 'In communication'
      when 'negotiating' then 'In communication'
      when 'agreed' then case when new.core_status = 'client_OK' then 'client_OK' else 'Price_ok' end
      when 'writing' then 'Sent_article'
      when 'review' then 'Sent_article'
      when 'sent' then 'Sent_article'
      when 'paid' then 'Paid'
      when 'published' then 'Published'
      when 'lost' then case when new.core_status in ('Low_metrics', 'Bad_Cat', 'Over_priced', 'Poor_Article', 'No_Index') then new.core_status else 'Over_priced' end
    end;
    if new.stage = 'contacted' and coalesce(new.indicator, '') <> 'waiting' then new.indicator := 'waiting'; new.indicator_at := now(); end if;
    if new.stage in ('replied', 'negotiating') and coalesce(new.indicator, '') <> 'replied' then new.indicator := 'replied'; new.indicator_at := now(); end if;
    if new.stage = 'find' then new.indicator := null; new.indicator_at := null; end if;
    if new.stage not in ('find', 'lost') then new.in_comm := true; end if;
    if new.stage in ('agreed', 'writing', 'review', 'sent', 'paid', 'published') then new.in_gp := true; end if;
  elsif tg_op = 'INSERT' or new.core_status is distinct from old.core_status or new.indicator is distinct from old.indicator then
    d := public.stage_from(new.core_status, new.indicator);
    if tg_op = 'INSERT' or public.stage_family(d) <> public.stage_family(old.stage) then new.stage := d; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_donors_sync_stage on public.project_donors;
create trigger project_donors_sync_stage before insert or update on public.project_donors for each row execute function public.sync_stage();

-- Перенос существующих данных
update public.project_donors set stage = public.stage_from(core_status, indicator) where stage = 'find';
create index if not exists project_donors_stage_idx on public.project_donors (project_id, stage);

-- Фиксированный search_path для функций (рекомендация Security Advisor)
alter function public.stage_from(text, text) set search_path = public;
alter function public.stage_family(text) set search_path = public;
alter function public.sync_stage() set search_path = public;
