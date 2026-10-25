"use client";

// Угоди кампанії: лінія-шлях, ціна, що далі. Лист «тим, кому ще не писали» — одним кліком з шаблоном кампанії.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StepPath from "@/components/StepPath";
import DonorCard from "@/app/app/projects/[id]/DonorCard";
import GroupMail from "@/app/app/projects/[id]/GroupMail";
import { setDealsCampaign } from "../actions";
import { DEAL_STEP_KEY, DEAL_STEP_SHORT, dealNext, dealPath } from "@/lib/deal";
import { STAGES, STAGE_KEY, stageOf } from "@/lib/stages";
import { fmtAmount } from "@/lib/money";
import type { ProjectDonor } from "@/lib/project";
import { useI18n } from "@/components/I18nProvider";

const PER_PAGE = 100;

export default function CampaignDeals({ campaignId, template, rows }: { campaignId: string; template: string; rows: ProjectDonor[] }) {
  const { t, intl } = useI18n();
  const router = useRouter();
  const [card, setCard] = useState<ProjectDonor | null>(null);
  const [mail, setMail] = useState<string[] | null>(null);
  const [shown, setShown] = useState(PER_PAGE);
  const [pending, start] = useTransition();
  const statusOpts = useMemo(() => [...STAGES.map((s) => ({ value: s as string, label: t(STAGE_KEY[s]) })), { value: "lost", label: `✕ ${t(STAGE_KEY.lost)}` }], [t]);
  const notWritten = rows.filter((d) => stageOf(d) === "find" && d.med_base.trim());

  return (
    <section className="card flex flex-col gap-2 p-0">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <p className="lbl mr-auto">{t("cmp.dealsTitle", { n: rows.length })}</p>
        {notWritten.length > 0 && (
          <button type="button" className="btn btn-pri btn-sm" onClick={() => setMail(notWritten.map((d) => d.id))}>
            ✉ {t("cmp.writeNew", { n: notWritten.length })}
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-mute">{t("cmp.noDeals")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Domain</th>
                <th>{t("med.intermediary")}</th>
                <th>{t("dp.path")}</th>
                <th>{t("common.price")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((d) => {
                const p = dealPath(d);
                const nx = dealNext(d);
                return (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap font-mono font-semibold">
                      <button type="button" className="underline" onClick={() => setCard(d)}>{d.domain}</button>
                    </td>
                    <td className="max-w-40 truncate">{d.med_base || <span className="text-mute">—</span>}</td>
                    <td>
                      <StepPath compact steps={p.steps.map((x) => ({ label: t(DEAL_STEP_SHORT[x.key]), mark: x.mark, title: t(DEAL_STEP_KEY[x.key]) }))} onClick={() => setCard(d)} title={t("dp.open")} />
                      {nx && <span className={`block truncate text-[11px] ${p.lost ? "text-bad" : "text-accent"}`}>→ {t(nx.key)}</span>}
                    </td>
                    <td className="whitespace-nowrap font-mono">{d.gp_price == null ? "—" : fmtAmount(d.gp_price, d.gp_currency || "USD", intl)}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs text-mute"
                        disabled={pending}
                        aria-label={t("cmp.remove")}
                        title={t("cmp.remove")}
                        onClick={() => start(async () => { await setDealsCampaign([d.id], null); router.refresh(); })}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <button type="button" className="btn mb-3 self-center" onClick={() => setShown(shown + PER_PAGE)}>
          {t("sheet.more", { shown, total: rows.length })}
        </button>
      )}
      <p className="px-4 pb-3 text-xs text-mute">{t("cmp.addHint")}</p>
      {card && <DonorCard projectId={card.project_id} donor={card} statusOpts={statusOpts} onClose={() => setCard(null)} />}
      {mail && <GroupMail donorIds={mail} initialTemplate={template} onClose={() => { setMail(null); router.refresh(); }} />}
    </section>
  );
}
