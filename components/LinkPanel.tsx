"use client";

// Посилання: що очікуємо ↔ що знайшла остання перевірка (✓ / ✕), стрічка історії перевірок і «Перевірити зараз».
import { useEffect, useState, useTransition } from "react";
import { getLinkChecks, setLinkExpected, type LinkCheckRow } from "@/app/app/projects/deal-actions";
import { checkDonorLink } from "@/app/app/projects/actions";
import { LINK_STATUS, type LinkStatus } from "@/lib/project";
import { noteText } from "@/lib/linkcheck";
import { useI18n } from "@/components/I18nProvider";

const DOT: Record<string, string> = { ok: "var(--ok)", error: "var(--line-strong)", blocked: "var(--line-strong)" };

export default function LinkPanel({
  donorId,
  projectId,
  articleUrl,
  pageUrl,
  anchors,
  expectedRel,
  status,
  suspect,
  onChecked,
}: {
  donorId: string;
  projectId: string;
  articleUrl: string;
  pageUrl: string;
  anchors: string;
  expectedRel: string;
  status: string;
  suspect: string;
  onChecked: () => void;
}) {
  const { t, intl } = useI18n();
  const [checks, setChecks] = useState<LinkCheckRow[] | null>(null);
  const [rel, setRel] = useState(expectedRel || "dofollow");
  const [pending, start] = useTransition();

  useEffect(() => {
    getLinkChecks(donorId).then(setChecks).catch(() => setChecks([]));
  }, [donorId]);

  if (!articleUrl.trim()) return <p className="note">{t("lc.afterUrl")}</p>;
  const last = checks?.[0];
  const st = LINK_STATUS[status as LinkStatus] ?? LINK_STATUS[""];
  const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const anchorList = anchors.split(/[,;|\n]+/).map((a) => a.trim().toLowerCase()).filter(Boolean);

  // Строки сравнения: ожидаем → нашли → совпало?
  const rows: { label: string; want: string; got: string; ok: boolean | null }[] = last
    ? [
        { label: t("lp.article"), want: host(articleUrl), got: last.http_status ? `${last.http_status}${last.final_url && host(last.final_url) !== host(articleUrl) ? ` → ${host(last.final_url)}` : ""}` : "—", ok: last.http_status ? last.http_status < 400 : null },
        { label: t("lp.target"), want: host(pageUrl) || "—", got: last.found ? host(last.found_href) : t("lp.notFound"), ok: last.outcome === "target" ? false : last.found ? true : last.http_status && last.http_status < 400 ? false : null },
        { label: t("lp.anchor"), want: anchors || t("lp.any"), got: last.found_anchor || "—", ok: !last.found ? null : !anchorList.length ? true : anchorList.some((a) => last.found_anchor.toLowerCase().includes(a)) },
        { label: t("lp.rel"), want: rel === "any" ? t("lp.relAny") : "dofollow", got: last.found ? last.found_rel || "dofollow" : "—", ok: !last.found ? null : rel === "any" ? true : !/\b(nofollow|sponsored|ugc)\b/.test(last.found_rel) },
        { label: t("lp.index"), want: t("lp.indexed"), got: last.http_status && last.http_status < 400 ? (last.noindex ? "noindex" : "index") : "—", ok: last.http_status && last.http_status < 400 ? !last.noindex : null },
      ]
    : [];

  const run = () =>
    start(async () => {
      await checkDonorLink(donorId, projectId);
      setChecks(await getLinkChecks(donorId));
      onChecked();
    });

  return (
    <section className="flex flex-col gap-2 rounded-md bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="lbl mr-auto">{t("lp.title")}</p>
        <span className={`pill ${st.tone === "ok" ? "pill-ok" : st.tone === "bad" ? "pill-bad" : st.tone === "warn" ? "pill-warn" : ""}`}>{t(st.key)}</span>
        <button type="button" className="btn btn-sm" disabled={pending} onClick={run}>{pending ? t("lc.checking") : `↻ ${t("lc.checkNow")}`}</button>
      </div>
      {status === "suspect" && suspect && (
        <p className="text-xs text-warn">{t("lp.suspect", { x: t((LINK_STATUS[suspect as LinkStatus] ?? LINK_STATUS[""]).key) })}</p>
      )}

      {last ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute">
                <th className="py-1 pr-2 font-normal"></th>
                <th className="py-1 pr-2 font-normal">{t("lp.want")}</th>
                <th className="py-1 pr-2 font-normal">{t("lp.got")} · {new Date(last.checked_at).toLocaleString(intl, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line">
                  <td className="py-1.5 pr-2 text-xs text-mute">{r.label}</td>
                  <td className="max-w-40 truncate py-1.5 pr-2 font-mono text-xs" title={r.want}>{r.want}</td>
                  <td className={`max-w-48 truncate py-1.5 pr-2 font-mono text-xs ${r.ok === false ? "text-bad" : ""}`} title={r.got}>{r.got}</td>
                  <td className={`py-1.5 font-mono ${r.ok ? "text-ok" : r.ok === false ? "text-bad" : "text-mute"}`}>{r.ok ? "✓" : r.ok === false ? "✕" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {last.note && <p className="mt-1 text-xs text-mute">{noteText(last.note, t)}</p>}
        </div>
      ) : (
        <p className="text-sm text-mute">{checks ? t("lp.noChecks") : "…"}</p>
      )}

      {checks && checks.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-mute">{t("lp.history", { n: checks.length })}</p>
          <div className="flex flex-wrap gap-1" aria-label={t("lp.history", { n: checks.length })}>
            {[...checks].reverse().map((c) => (
              <span
                key={c.id}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: DOT[c.outcome] ?? "var(--bad)" }}
                title={`${new Date(c.checked_at).toLocaleString(intl)} · ${t((LINK_STATUS[c.outcome as LinkStatus] ?? LINK_STATUS[""]).key)}`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-mute">{t("lp.legend")}</p>
        </div>
      )}

      <label className="mt-1 flex items-center gap-2 border-t border-line pt-2 text-sm">
        <input
          type="checkbox"
          checked={rel === "any"}
          onChange={(e) => {
            const v = e.target.checked ? "any" : "dofollow";
            setRel(v);
            start(async () => { await setLinkExpected(donorId, v); });
          }}
        />
        {t("lp.allowNofollow")}
      </label>
    </section>
  );
}
