// Публичный отчёт по проекту для клиента. Открывается без входа по секретной ссылке.
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/global";
import { LINK_STATUS, type LinkStatus } from "@/lib/project";
import { fmtAmount } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Звіт по посиланнях", robots: { index: false, follow: false } };

type Params = Promise<{ token: string }>;
type Link = {
  domain: string;
  article_url: string;
  page_url: string;
  anchors: string;
  gp_status: string;
  core_status: string;
  published_at: string | null;
  link_status: LinkStatus;
  link_checked_at: string | null;
  price: number | null;
  currency: string | null;
};
type Report = { project: string; plan: number; show_prices: boolean; links: Link[] };

const TONE = { ok: "pill-ok", bad: "pill-bad", warn: "pill-warn", "": "" } as const;

export default async function ReportPage({ params }: { params: Params }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_report", { p_token: token });
  const report = data as Report | null;

  if (!report) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-4 py-12 text-center">
        <h1 className="font-display text-xl font-medium">Звіт недоступний</h1>
        <p className="text-mute">Посилання неправильне або його вимкнули. Попросіть нове посилання у свого підрядника.</p>
      </main>
    );
  }

  const published = report.links.filter((l) => l.core_status === "Published" || !!l.article_url);
  const inWork = report.links.length - published.length;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-10">
      <div>
        <p className="lbl">Звіт по посиланнях</p>
        <h1 className="font-display text-2xl font-medium">{report.project}</h1>
        <p className="mt-1 text-mute">
          Розміщено: <b className="font-mono">{published.length}</b> · у роботі: <b className="font-mono">{inWork}</b>
          {report.plan > 0 && <> · план на місяць: <b className="font-mono">{report.plan}</b></>}
        </p>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {["Сайт", "Стаття", "Сторінка", "Анкор", "Дата", "Перевірка", ...(report.show_prices ? ["Ціна"] : [])].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.links.map((l, i) => {
              const s = LINK_STATUS[l.link_status] ?? LINK_STATUS[""];
              return (
                <tr key={i}>
                  <td className="font-mono font-semibold whitespace-nowrap">{l.domain}</td>
                  <td className="max-w-64 truncate">
                    {l.article_url ? (
                      <a href={/^https?:\/\//.test(l.article_url) ? l.article_url : `https://${l.article_url}`} target="_blank" rel="noreferrer" className="underline">
                        {l.article_url}
                      </a>
                    ) : (
                      <span className="text-mute">ще не розміщено</span>
                    )}
                  </td>
                  <td className="max-w-48 truncate">{l.page_url || "—"}</td>
                  <td className="max-w-48 truncate">{l.anchors || "—"}</td>
                  <td className="font-mono whitespace-nowrap">{l.published_at ? fmtDate(l.published_at) : "—"}</td>
                  <td>
                    {l.article_url ? (
                      <span className={`pill ${TONE[s.tone]}`} title={l.link_checked_at ? `перевірено ${fmtDate(l.link_checked_at)}` : undefined}>
                        {s.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {report.show_prices && (
                    <td className="font-mono">{l.price == null ? "—" : fmtAmount(l.price, l.currency ?? "USD")}</td>
                  )}
                </tr>
              );
            })}
            {report.links.length === 0 && (
              <tr><td colSpan={7} className="text-center text-mute">Поки немає розміщень.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-mute">
        Звіт оновлюється автоматично. Посилання перевіряються щодня: чи на місці, чи без nofollow, чи сторінка відкрита для індексації.
      </p>
    </main>
  );
}
