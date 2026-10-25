-- В Outreach домен попадает только пройдя все этапы Prefero.
-- Домены, отправленные в Outreach раньше (до проверки Category page), но там ещё не начатые (этап «find»),
-- возвращаются в Prefero — допроверить. Начатые сделки не трогаем: приложение покажет, чего не хватает.
update public.project_donors
  set fg_status = 'new'
  where fg_status = 'core'
    and stage = 'find'
    and not (
      coalesce(checks->>'topic', '') = 'ok'
      and (coalesce(category_page, '') <> '' or coalesce(checks->>'category', '') = 'ok')
      and coalesce(checks->>'geo', '') <> 'no'
    );
