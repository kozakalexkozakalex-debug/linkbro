// Supabase отдаёт максимум 1000 строк за запрос. Эта функция забирает всё страницами.
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

export async function fetchAll<T>(page: (from: number, to: number) => Page): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
