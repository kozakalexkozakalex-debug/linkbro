# LinkBro

CRM для команд линкбилдеров: доноры проходят путь Инпут → Глобальная база → проект (From Global → Project Core → Communication → Guest Posting), тимлид видит план, факт и расходы.

## Стек
- Next.js (App Router) + TypeScript + Tailwind
- Supabase: база, вход, файлы
- Хостинг: Vercel (Hobby), при росте — VPS с Coolify через `Dockerfile`

## Настройки
Все ключи задаются переменными окружения, список — в `.env.example`.

## База данных
Структура базы меняется только SQL-миграциями из папки `supabase/migrations`, по порядку номеров. На каждой таблице включён Row Level Security.

## Запуск на компьютере (по желанию)
```
npm install
cp .env.example .env.local   # и вставить свои значения
npm run dev
```
