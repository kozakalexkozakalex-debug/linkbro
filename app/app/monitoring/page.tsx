import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { getScope } from "@/lib/scope";
import { getI18n } from "@/lib/i18n/server";
import { daysLeft } from "@/lib/money";
import { LINK_STATUS, type LinkStatus } from "@/lib/project";
import { noteText } from "@/lib/linkcheck";
import { loadPlacements, monState } from "@/lib/monitoring";
import ModuleHead from "@/components/ModuleHead";
import MonitorTabs from "@/components/MonitorTabs";
import type { MsgKey } from "@/lib/i18n/config";

export const maxDuration = 60;

// Моніторинг → Огляд: що потребує уваги зараз і що змінилось останнім часом. Кожна цифра веде в потрібний список.
type Iss = { id: string; donor_id: string; type: string; severity: string; status: string; detected_at: string; updated_at: string; resolution: string; project_donors: { domain: string } | { domain: string }[] | null };
const ISS_KEY: Record<string, MsgKey> = { detected: "iss.sDetected", confirmed: "iss.sConfirmed", in_progress: "iss.sInProgress", resolved: "iss.sResolved", false_positive: "iss.sFalse" };

export default async function MonitoringOverview() {
  const [{ projectId, projects }, { t, intl }, { supabase, team }] = await Promise.all([getScope(), getI18n(), getTeamContext()]);
  let iq = supabase
    .from("link_issues")
    .select("id, donor_id, type, severity, status, detected_at, updated_at, resolution, project_donors(domain)")
    .eq("team_id", team.id)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (projectId) iq = iq.eq("project_id", projectId);
  const [rows, { data: iss }] = await Promise.all([loadPlacements(supabase, team.id, projectId), iq]);
  const issues = (iss ?? []) as Iss[];
  const dom = (i: Iss) => (Array.isArray(i.project_donors) ? i.project_donors[0]?.domain : i.project_donors?.domain) ?? "—";

  const now = Date.now();
  const st = rows.map((d) => ({ d, s: monState(d) }));
  const count = (s: string) => st.filter((x) => x.s === s).length;
  const overdue = st.filter((x) => x.s !== "nourl" && x.d.link_next_check_at && new Date(x.d.link_next_check_at).getTime() < now - 3 * 3_600_000).length;
  const guarantee = rows.filter((d) => { const l = daysLeft(d.guarantee_until); return l != null && l >= 0 && l <= 14; });
  const openIss = issues.filter((i) => ["confirmed", "in_progress"].includes(i.status));
  const sevOrder = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  const attention = [
    ...openIss.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]).map((i) => ({ key: i.id, icon: "!", tone: i.severity === "high" ? "text-bad" : "text-warn", domain: dom(i), text: t((LINK_STATUS[i.type as LinkStatus] ?? LINK_STATUS[""]).key), href: "/app/monitoring/issues" })),
    ...st.filter((x) => x.s === "suspect").map((x) => ({ key: x.d.id, icon: "~", tone: "text-warn", domain: x.d.domain, text: t("ov.suspectRow", { x: t((LINK_STATUS[x.d.link_suspect as LinkStatus] ?? LINK_STATUS[""]).key) }), href: "/app/monitoring/links?f=suspect" })),
    ...st.filter((x) => x.s === "tech" && x.d.link_fail_count >= 3).map((x) => ({ key: x.d.id, icon: "?", tone: "text-mute", domain: x.d.domain, text: `${noteText(x.d.link_note, t)} · ${t("ov.manual")}`, href: "/app/monitoring/links?f=tech" })),
  ].slice(0, 12);
  const recent = [...issues].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 10);
  const dt = (iso: string) => new Date(iso).toLocaleString(intl, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const tiles = [
    { n: count("ok"), label: t("ov.tOk"), tone: "text-ok", href: "/app/monitoring/links?f=ok" },
    { n: openIss.length, label: t("ov.tProblems"), tone: openIss.length ? "text-bad" : "", href: "/app/monitoring/issues" },
    { n: count("suspect"), label: t("mon.suspectHint"), tone: count("suspect") ? "text-warn" : "", href: "/app/monitoring/links?f=suspect" },
    { n: count("tech"), label: t("ov.tTech"), tone: "", href: "/app/monitoring/links?f=tech" },
    { n: count("unchecked") + overdue, label: t("ov.tWaiting", { o: overdue }), tone: "", href: "/app/monitoring/links?f=unchecked" },
    { n: guarantee.length, label: t("mon.guarantee14"), tone: guarantee.length ? "text-accent" : "", href: "/app/monitoring/links?f=guarantee" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ModuleHead title={t("ptab.monitor")} project={projectId ? projects.find((p) => p.id === projectId)?.name : t("dash.allProjects")} module="project" />
      <MonitorTabs on="overview" open={openIss.length} />
      <p className="text-sm text-mute">{t("ov.total", { n: rows.length - count("nourl") })}{count("nourl") ? ` · ${t("mon.noUrl", { n: count("nourl") })}` : ""}</p>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((x) => (
          <Link key={x.href + x.label} href={x.href} className="card flex flex-col gap-0.5 py-3 hover:border-accent">
            <span className={`font-mono text-2xl font-bold tabular-nums ${x.n ? x.tone : "text-mute"}`}>{x.n}</span>
            <span className="text-xs leading-tight text-mute">{x.label}</span>
          </Link>
        ))}
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card">
          <p className="lbl mb-2">{t("ov.attention")}</p>
          {attention.length === 0 ? (
            <p className="text-sm text-mute">{t("dash.allOk")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-baseline gap-2 py-1.5">
                    <span className={`w-4 font-mono font-bold ${a.tone}`}>{a.icon}</span>
                    <span className="font-mono">{a.domain}</span>
                    <span className="min-w-0 flex-1 truncate text-mute">{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <p className="lbl mb-2">{t("ov.recent")}</p>
          {recent.length === 0 ? (
            <p className="text-sm text-mute">{t("common.none")}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((i) => (
                <li key={i.id} className="flex items-baseline gap-2 py-1.5">
                  <span className={`w-4 font-mono font-bold ${i.status === "resolved" || i.status === "false_positive" ? "text-ok" : "text-warn"}`}>{i.status === "resolved" || i.status === "false_positive" ? "✓" : "!"}</span>
                  <span className="font-mono">{dom(i)}</span>
                  <span className="min-w-0 flex-1 truncate text-mute">{t((LINK_STATUS[i.type as LinkStatus] ?? LINK_STATUS[""]).key)} · {t(ISS_KEY[i.status])}</span>
                  <span className="shrink-0 font-mono text-xs text-mute">{dt(i.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
