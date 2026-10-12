"use client";

import { setGpStatus } from "../actions";
import DonorCell from "@/components/DonorCell";
import StatusSelect from "@/components/StatusSelect";
import LinkCheck from "@/components/LinkCheck";
import DupeBadge from "@/components/DupeBadge";
import { DonorValueInput, DonorValueSelect } from "@/components/DonorValue";
import { GP_STATUSES, type ProjectDonor } from "@/lib/project";
import { CURRENCIES, PAY_STATUSES, SOURCES, daysLeft, fmtAmount, payState, realCost } from "@/lib/money";

const tone = (v: string) => (v === "Paid" ? "ok" : v === "Need to correct" ? "bad" : "") as "ok" | "bad" | "";
const payTone = (v: string) => (v === "paid" ? "stsel-ok" : v === "refund" ? "stsel-bad" : "");
const CUR_OPTS = CURRENCIES.map((c) => ({ value: c, label: c }));
const INDEX_OPTS = [
  { value: "", label: "—" },
  { value: "yes", label: "так" },
  { value: "no", label: "ні" },
];

export default function GuestPosting({
  projectId,
  rows,
  dupes,
}: {
  projectId: string;
  rows: ProjectDonor[];
  dupes: Record<string, string[]>;
}) {
  return (
    <>
      <p className="text-sm text-mute">
        Посередник і ціна переносяться з Communication. Реальна ціна = ціна + комісія біржі. Посилання з Article URL перевіряються
        автоматично щодня, кнопка ↻ перевіряє одразу.
      </p>

      <datalist id="gp-sources">
        {SOURCES.map((s) => <option key={s.name} value={s.name} />)}
      </datalist>

      {rows.length === 0 ? (
        <div className="card text-center text-mute">
          Відкривається після статусу Accepted у Communication або Price_ok у Project Core.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {[
                  "Domain",
                  "Посередник",
                  "Джерело",
                  "Price",
                  "Валюта",
                  "Комісія %",
                  "Реальна ціна",
                  "Оплата",
                  "Payments",
                  "Link to the article",
                  "Page URL",
                  "Keywords (Anchor)",
                  "Pre-Anchor text",
                  "Article URL",
                  "Status (GP)",
                  "Посилання",
                  "Індексація",
                  "Гарантія до",
                ].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const left = daysLeft(d.guarantee_until);
                return (
                  <tr key={d.id}>
                    <td className="font-mono font-semibold whitespace-nowrap">
                      {d.domain}
                      <DupeBadge items={dupes[d.domain]} />
                    </td>
                    <td><DonorCell id={d.id} field="gp_med" value={d.gp_med} width={180} placeholder="email посередника" /></td>
                    <td>
                      <DonorValueInput id={d.id} projectId={projectId} field="gp_source" value={d.gp_source} list="gp-sources" width={120} placeholder="біржа / напряму" />
                    </td>
                    <td><DonorCell id={d.id} field="gp_price" value={d.gp_price} width={80} mono /></td>
                    <td><DonorValueSelect id={d.id} projectId={projectId} field="gp_currency" value={d.gp_currency} options={CUR_OPTS} /></td>
                    <td>
                      <DonorValueInput id={d.id} projectId={projectId} field="gp_commission" value={String(d.gp_commission ?? 0)} width={60} />
                    </td>
                    <td className="font-mono whitespace-nowrap">
                      {d.gp_price == null ? "—" : fmtAmount(realCost(d), d.gp_currency)}
                    </td>
                    <td>
                      <DonorValueSelect
                        id={d.id}
                        projectId={projectId}
                        field="pay_status"
                        value={d.pay_status || (payState(d) === "paid" ? "paid" : "")}
                        options={PAY_STATUSES}
                        tone={payTone}
                      />
                    </td>
                    <td><DonorCell id={d.id} field="payments" value={d.payments} placeholder="лінк на оплату" /></td>
                    <td><DonorCell id={d.id} field="article_link" value={d.article_link} placeholder="документ або посилання" /></td>
                    <td><DonorCell id={d.id} field="page_url" value={d.page_url} placeholder="сторінка клієнта" /></td>
                    <td><DonorCell id={d.id} field="anchors" value={d.anchors} placeholder="через кому" /></td>
                    <td><DonorCell id={d.id} field="pre_anchor" value={d.pre_anchor} /></td>
                    <td><DonorCell id={d.id} field="article_url" value={d.article_url} placeholder="розміщена стаття" /></td>
                    <td>
                      <StatusSelect
                        id={`gp-${d.id}`}
                        value={d.gp_status}
                        emptyLabel="—"
                        groups={[{ options: GP_STATUSES }]}
                        tone={tone}
                        onChange={(v) => setGpStatus(d.id, projectId, v)}
                      />
                    </td>
                    <td>
                      <LinkCheck
                        id={d.id}
                        projectId={projectId}
                        status={d.link_status}
                        note={d.link_note}
                        checkedAt={d.link_checked_at}
                        hasUrl={!!d.article_url}
                      />
                    </td>
                    <td>
                      <DonorValueSelect
                        id={d.id}
                        projectId={projectId}
                        field="indexed"
                        value={d.indexed == null ? "" : d.indexed ? "yes" : "no"}
                        options={INDEX_OPTS}
                        tone={(v) => (v === "yes" ? "stsel-ok" : v === "no" ? "stsel-bad" : "")}
                      />
                    </td>
                    <td className="whitespace-nowrap">
                      <DonorValueInput id={d.id} projectId={projectId} field="guarantee_until" value={d.guarantee_until ?? ""} type="date" width={140} />
                      {left != null && (
                        <span className={`pill ml-1 ${left < 0 ? "" : left <= 7 ? "pill-warn" : "pill-ok"}`} suppressHydrationWarning>
                          {left < 0 ? "закінчилась" : `${left} дн`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
