"use client";

// Таблиця проблем: важливість, що сталося, з якого часу, статус, хто вирішує, до коли, дії
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commentIssue, updateIssue } from "../actions";
import { checkDonorLink } from "@/app/app/projects/actions";
import { LINK_STATUS, type LinkStatus, type Member } from "@/lib/project";
import { daysLeft } from "@/lib/money";
import { useI18n } from "@/components/I18nProvider";
import type { MsgKey } from "@/lib/i18n/config";

export type IssueRow = {
  id: string;
  donor_id: string;
  project_id: string;
  type: string;
  severity: "high" | "medium" | "low";
  status: "detected" | "confirmed" | "in_progress" | "resolved" | "false_positive";
  detected_at: string;
  confirmed_at: string | null;
  resolved_at: string | null;
  assignee: string | null;
  due_date: string | null;
  resolution: string;
  domain: string;
  med: string;
  articleUrl: string;
  guarantee: string | null;
  project: string;
};

const SEV: Record<IssueRow["severity"], { key: MsgKey; color: string }> = {
  high: { key: "iss.high", color: "var(--bad)" },
  medium: { key: "iss.medium", color: "var(--warn)" },
  low: { key: "iss.low", color: "var(--mute)" },
};
const STATUS: IssueRow["status"][] = ["detected", "confirmed", "in_progress", "resolved", "false_positive"];
const STATUS_KEY: Record<IssueRow["status"], MsgKey> = {
  detected: "iss.sDetected",
  confirmed: "iss.sConfirmed",
  in_progress: "iss.sInProgress",
  resolved: "iss.sResolved",
  false_positive: "iss.sFalse",
};
const NEXT_KEY: Record<string, MsgKey> = {
  missing: "iss.nMissing",
  nofollow: "iss.nNofollow",
  noindex: "iss.nNoindex",
  anchor: "iss.nAnchor",
  target: "iss.nTarget",
};

export default function IssuesTable({ rows, members }: { rows: IssueRow[]; members: Member[] }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intl, { day: "2-digit", month: "2-digit" }) : "—");

  const save = (id: string, patch: Parameters<typeof updateIssue>[1]) =>
    start(async () => {
      const r = await updateIssue(id, patch);
      if (!r.ok) return setErr(r.error);
      router.refresh();
    });

  if (!rows.length) return <p className="card text-center text-mute">{t("iss.empty")}</p>;

  return (
    <div className="flex flex-col gap-2">
      {err && <p className="note note-bad">{err}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const left = daysLeft(r.guarantee);
          const late = r.due_date && r.due_date < today && ["confirmed", "in_progress"].includes(r.status);
          const closed = r.status === "resolved" || r.status === "false_positive";
          return (
            <li key={r.id} className={`card flex flex-col gap-2 ${closed ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEV[r.severity].color }} title={t(SEV[r.severity].key)} />
                <span className="font-mono font-semibold">{r.domain}</span>
                {r.project && <span className="pill">{r.project}</span>}
                <span className="pill pill-bad">{t((LINK_STATUS[r.type as LinkStatus] ?? LINK_STATUS[""]).key)}</span>
                <span className="text-xs text-mute">{t(SEV[r.severity].key)}</span>
                {left != null && left >= 0 && <span className="pill pill-warn">🛡 {t("unit.days", { n: left })}</span>}
                <span className="ml-auto text-xs text-mute">
                  {t("iss.detected", { d: dt(r.detected_at) })}
                  {r.confirmed_at ? ` · ${t("iss.confirmed", { d: dt(r.confirmed_at) })}` : ""}
                  {r.resolved_at ? ` · ${t("iss.resolved", { d: dt(r.resolved_at) })}` : ""}
                </span>
              </div>
              {!closed && NEXT_KEY[r.type] && <p className="text-sm text-accent">→ {t(NEXT_KEY[r.type])}</p>}
              {r.resolution && <p className="text-sm text-mute">{r.resolution}</p>}
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px]">
                <select aria-label={t("common.status")} className="inp py-1 text-sm" value={r.status} disabled={pending} onChange={(e) => save(r.id, { status: e.target.value })}>
                  {STATUS.map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
                </select>
                <select aria-label={t("common.assignee")} className="inp py-1 text-sm" value={r.assignee ?? ""} disabled={pending} onChange={(e) => save(r.id, { assignee: e.target.value || null })}>
                  <option value="">{t("common.withoutAssignee")}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input aria-label={t("iss.due")} type="date" className={`inp py-1 text-sm ${late ? "text-bad" : ""}`} value={r.due_date ?? ""} disabled={pending} onChange={(e) => save(r.id, { due_date: e.target.value || null })} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending || checking === r.id}
                  onClick={() =>
                    start(async () => {
                      setChecking(r.id);
                      await checkDonorLink(r.donor_id, r.project_id);
                      setChecking(null);
                      router.refresh();
                    })
                  }
                >
                  {checking === r.id ? t("lc.checking") : `↻ ${t("lc.checkNow")}`}
                </button>
                {r.med && <Link href={`/app/intermediaries/profile?c=${encodeURIComponent(r.med)}`} className="btn btn-sm">✉ {t("iss.writeMed")}</Link>}
                {r.articleUrl && <a href={/^https?:\/\//.test(r.articleUrl) ? r.articleUrl : `https://${r.articleUrl}`} target="_blank" rel="noreferrer" className="btn btn-sm">↗ {t("iss.openArticle")}</a>}
                <input
                  aria-label={t("art.comment")}
                  className="inp min-w-0 flex-1 py-1 text-sm"
                  placeholder={t("iss.commentPh")}
                  value={comment[r.id] ?? ""}
                  onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending || !(comment[r.id] ?? "").trim()}
                  onClick={() =>
                    start(async () => {
                      const res = await commentIssue(r.id, comment[r.id] ?? "");
                      if (!res.ok) return setErr(res.error);
                      setComment({ ...comment, [r.id]: "" });
                    })
                  }
                >
                  + {t("art.comment")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
