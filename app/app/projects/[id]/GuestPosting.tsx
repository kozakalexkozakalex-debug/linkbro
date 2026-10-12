"use client";

import { setGpStatus } from "../actions";
import DonorCell from "@/components/DonorCell";
import StatusSelect from "@/components/StatusSelect";
import { GP_STATUSES, type ProjectDonor } from "@/lib/project";

const tone = (v: string) => (v === "Paid" ? "ok" : v === "Need to correct" ? "bad" : "") as "ok" | "bad" | "";

export default function GuestPosting({ projectId, rows }: { projectId: string; rows: ProjectDonor[] }) {
  return (
    <>
      <p className="text-sm text-mute">
        Посередник і ціна переносяться з Communication. «Paid» рахується як оплачено в дашборді.
      </p>

      {rows.length === 0 ? (
        <div className="card text-center text-mute">
          Відкривається після статусу Accepted у Communication або Price_ok у Project Core.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["Domain", "Посередник", "Price", "Payments", "Link to the article", "Page URL", "Keywords (Anchor)", "Pre-Anchor text", "Article URL", "Status (GP)"].map(
                  (h) => <th key={h}>{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono font-semibold whitespace-nowrap">{d.domain}</td>
                  <td><DonorCell id={d.id} field="gp_med" value={d.gp_med} width={190} placeholder="email посередника" /></td>
                  <td><DonorCell id={d.id} field="gp_price" value={d.gp_price} width={80} mono /></td>
                  <td><DonorCell id={d.id} field="payments" value={d.payments} placeholder="лінк на оплату" /></td>
                  <td><DonorCell id={d.id} field="article_link" value={d.article_link} placeholder="документ або посилання" /></td>
                  <td><DonorCell id={d.id} field="page_url" value={d.page_url} placeholder="сторінка клієнта" /></td>
                  <td><DonorCell id={d.id} field="anchors" value={d.anchors} /></td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
