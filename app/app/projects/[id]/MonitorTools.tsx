"use client";

// Шапка Моніторингу: сколько ссылок на месте / с проблемами / не проверено / гарантия скоро закончится,
// и «Перевірити всі» — проверка порциями по 10, с прогрессом.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkLinksBatch } from "../actions";
import { monitorOf } from "@/lib/stages";
import { daysLeft } from "@/lib/money";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

export default function MonitorTools({ items }: { items: ProjectDonor[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const withUrl = items.filter((d) => d.article_url);
  const col = (d: ProjectDonor) => monitorOf(d.link_status);
  const ok = withUrl.filter((d) => col(d) === "ok").length;
  const problems = withUrl.filter((d) => col(d) === "lost" || col(d) === "warn");
  const unchecked = withUrl.filter((d) => col(d) === "unchecked" || col(d) === "error");
  const guarantee = withUrl.filter((d) => {
    const l = daysLeft(d.guarantee_until);
    return l != null && l >= 0 && l <= 14;
  }).length;
  const noUrl = items.filter((d) => d.stage === "published" && !d.article_url).length;

  function run(list: ProjectDonor[]) {
    const ids = list.map((d) => d.id);
    if (!ids.length) return;
    start(async () => {
      const total: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 10) {
        setMsg(t("mon.progress", { n: i, total: ids.length }));
        const r = await checkLinksBatch(ids.slice(i, i + 10));
        for (const [k, v] of Object.entries(r.results)) total[k] = (total[k] ?? 0) + v;
      }
      const bad = (total.missing ?? 0) + (total.nofollow ?? 0) + (total.noindex ?? 0) + (total.anchor ?? 0);
      setMsg(t("mon.done", { n: ids.length, ok: total.ok ?? 0, bad, err: (total.error ?? 0) + (total.blocked ?? 0) }));
      router.refresh();
    });
  }

  const stat = (v: number, label: string, tone = "") => (
    <div className="card py-3">
      <p className={`font-mono text-xl font-semibold ${tone}`}>{v}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat(ok, t("mon.ok"), "text-ok")}
        {stat(problems.length, t("mon.problems"), problems.length ? "text-bad" : "")}
        {stat(unchecked.length, t("mon.uncheckedErr"))}
        {stat(guarantee, t("mon.guarantee14"), guarantee ? "text-accent" : "")}
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-pri" disabled={pending || !withUrl.length} onClick={() => run(withUrl)}>
          {t("mon.checkAll", { n: withUrl.length })}
        </button>
        {(problems.length > 0 || unchecked.length > 0) && (
          <button type="button" className="btn" disabled={pending} onClick={() => run([...problems, ...unchecked])}>
            {t("mon.checkBad", { n: problems.length + unchecked.length })}
          </button>
        )}
        {msg && <span className="text-sm text-mute">{msg}</span>}
      </div>
      {noUrl > 0 && <p className="text-sm text-accent">{t("mon.noUrl", { n: noUrl })}</p>}
    </div>
  );
}
