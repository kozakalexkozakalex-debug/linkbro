-- =====================================================================
-- LinkBro · 0002
-- Деньги (валюта, комиссия, оплата), гарантия и мониторинг ссылок,
-- история действий, публичный отчёт для клиента.
-- Запускать один раз в Supabase → SQL Editor, после 0001.
-- =====================================================================

-- ---------- Деньги и мониторинг в доноре проекта ----------
alter table public.project_donors
  add column gp_source       text    not null default '',
  add column gp_currency     text    not null default 'USD' check (gp_currency in ('USD', 'EUR', 'UAH')),
  add column gp_commission   numeric not null default 0 check (gp_commission >= 0 and gp_commission <= 100),
  add column pay_status      text    not null default '' check (pay_status in ('', 'due', 'paid', 'refund')),
  add column paid_at         timestamptz,
  add column guarantee_until date,
  add column link_status     text    not null default ''
    check (link_status in ('', 'ok', 'missing', 'nofollow', 'noindex', 'anchor', 'error', 'blocked')),
  add column link_note       text    not null default '',
  add column link_checked_at timestamptz,
  add column indexed         boolean;

create index project_donors_check_idx on public.project_donors (link_checked_at nulls first) where article_url <> '';
create index project_donors_med_idx on public.project_donors (team_id, med_base) where med_base <> '';
create index project_donors_domain_idx on public.project_donors (team_id, domain);

-- ---------- Публичный отчёт по проекту ----------
alter table public.projects
  add column report_token       text unique,
  add column report_show_prices boolean not null default false;

-- ---------- История действий ----------
create table public.activity_log (
  id         bigint generated always as identity primary key,
  team_id    uuid not null references public.teams (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  donor_id   uuid references public.project_donors (id) on delete set null,
  domain     text,
  user_id    uuid references auth.users (id) on delete set null,
  field      text not null,
  old_value  text,
  new_value  text,
  created_at timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);
create index activity_log_team_idx on public.activity_log (team_id, created_at desc);

alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon;
revoke insert, update, delete on public.activity_log from authenticated;
grant select on public.activity_log to authenticated;
create policy "activity: читать участникам" on public.activity_log
  for select to authenticated using ((select public.is_team_member(team_id)));

-- Записываем изменения ключевых полей донора автоматически
create function public.log_donor_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  f text;
  o text;
  n text;
begin
  foreach f in array array[
    'fg_status', 'core_status', 'comm_status', 'gp_status', 'assignee',
    'pay_status', 'gp_price', 'gp_currency', 'link_status', 'indicator'
  ]
  loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f) into o, n using old, new;
    if o is distinct from n then
      insert into public.activity_log (team_id, project_id, donor_id, domain, user_id, field, old_value, new_value)
      values (new.team_id, new.project_id, new.id, new.domain, auth.uid(), f, o, n);
    end if;
  end loop;
  return new;
end;
$$;

create trigger project_donors_log
  after update on public.project_donors
  for each row execute function public.log_donor_changes();

revoke all on function public.log_donor_changes() from public, anon, authenticated;

-- ---------- Отчёт для клиента по секретной ссылке (без входа) ----------
create function public.public_report(p_token text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'project', p.name,
    'plan', p.plan_per_month,
    'show_prices', p.report_show_prices,
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'domain', d.domain,
        'article_url', d.article_url,
        'page_url', d.page_url,
        'anchors', d.anchors,
        'gp_status', d.gp_status,
        'core_status', d.core_status,
        'published_at', d.published_at,
        'link_status', d.link_status,
        'link_checked_at', d.link_checked_at,
        'price', case when p.report_show_prices then d.gp_price end,
        'currency', case when p.report_show_prices then d.gp_currency end
      ) order by d.published_at desc nulls last, d.domain)
      from public.project_donors d
      where d.project_id = p.id and d.in_gp
    ), '[]'::jsonb)
  )
  from public.projects p
  where p_token is not null and length(p_token) >= 24 and p.report_token = p_token;
$$;

revoke all on function public.public_report(text) from public;
grant execute on function public.public_report(text) to anon, authenticated;
