// Доступ к базе в обход RLS. ТОЛЬКО для серверных задач по расписанию (мониторинг ссылок).
// Секретный ключ берётся из переменной окружения без приставки NEXT_PUBLIC_, в браузер не попадает.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
