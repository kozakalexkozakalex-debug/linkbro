# LinkBro — правила для работы с кодом

- Стек: Next.js (App Router) + TypeScript + Tailwind, Supabase. Новые библиотеки — только с объяснением, зачем.
- Все ключи и адреса — только через переменные окружения (см. `.env.example`).
- Секретные ключи (Supabase secret/service_role, AI-ключи) — только на сервере, никогда с приставкой `NEXT_PUBLIC_`.
- Структура базы — только SQL-миграции в `supabase/migrations/NNNN_name.sql`. Каждая таблица: RLS включён + политики доступа по членству в команде.
- Никаких платформо-специфичных сервисов хостинга (Vercel KV, Edge Config и т.п.). Данные — только в Supabase.
- `Dockerfile` должен оставаться рабочим.
- Интерфейс — на украинском, термины воронки как в ТЗ (From Global, Project Core, Communication, Guest Posting).
- Цвета и шрифты — токены из `app/globals.css` (взяты из прототипа).
- Каждая новая таблица в миграции: `enable row level security`, политики через `public.is_team_member(team_id)` / `public.is_team_lead(team_id)`, `revoke all ... from anon`, `grant ... to authenticated`.
- Миграцию перед отправкой прогоняем на локальном Postgres 16 с заглушкой схемы `auth` и проверяем, что чужая команда не видит данных.
