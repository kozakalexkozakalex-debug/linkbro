-- Prefero: ручные чекпоинты проекта по домену — GEO, тема, category page.
-- checks = {"geo": "ok"|"no", "topic": "ok"|"no", "category": "ok"|"no"}; нет ключа = ещё не проверено
-- (GEO тогда считается автоматически, category — «ок», если вписана Category page).
-- Метрики не храним: они считаются на лету из Confero и фильтра проекта. Новых таблиц нет, RLS прежний.
alter table public.project_donors add column if not exists checks jsonb not null default '{}'::jsonb;

-- Перенос того, что уже отмечали: ✓ темы = fg_status ok; причины отсева → соответствующий чекпоинт
update public.project_donors set checks = checks || '{"topic":"ok"}' where fg_status in ('ok', 'core') and not (checks ? 'topic');
update public.project_donors set checks = checks || '{"topic":"no"}' where fg_status = 'out' and reject_reason = 'topic' and not (checks ? 'topic');
update public.project_donors set checks = checks || '{"geo":"no"}'   where fg_status = 'out' and reject_reason = 'geo' and not (checks ? 'geo');
