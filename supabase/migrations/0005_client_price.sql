-- Цена для клиента (за сколько продаём ссылку). Маржа = эта цена − (цена посредника + комиссия).
-- Таблица project_donors уже под RLS с политиками по членству в команде, новая колонка их наследует.
alter table public.project_donors add column if not exists client_price numeric(12,2);
