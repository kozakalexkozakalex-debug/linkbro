-- =====================================================================
-- LinkBro · 0003
-- Ниша (категория) проекта: Real Estate, E-commerce, iGaming и т.д.
-- Запускать один раз в Supabase → SQL Editor, после 0002.
-- =====================================================================

alter table public.projects
  add column niche text not null default '' check (char_length(niche) <= 60);
