"use client";

// Кнопка «Nexo» в Outreach: база посередників выезжает справа (как Infero в Confero).
// Внутри: добавить вручную (один сайт или списком), сайты й ціни, люди. Полная страница — по стрелке ↗.
import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import Icon from "@/components/Icon";
import PeopleTable, { type PersonRow } from "@/app/app/intermediaries/PeopleTable";
import IntermediariesTable, { type IntermediaryRow } from "@/app/app/intermediaries/IntermediariesTable";
import NexoAdd from "@/app/app/intermediaries/NexoAdd";
import { getNexoData } from "@/app/app/intermediaries/nexo-actions";
import { useI18n } from "@/components/I18nProvider";

export default function NexoButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"sites" | "people">("sites");
  const [data, setData] = useState<{ people: PersonRow[]; sites: IntermediaryRow[] } | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const load = useCallback(() => {
    getNexoData()
      .then(setData)
      .catch(() => setData({ people: [], sites: [] }));
  }, []);

  useEffect(() => {
    if (open && !data) load();
  }, [open, data, load]);

  return (
    <>
      <button type="button" className="nexo-btn" onClick={() => setOpen(true)} title={t("nexo.sub")}>
        <Icon name="users" size={15} />
        Nexo
      </button>
      <Drawer open={open} onClose={close} title="Nexo" sub={t("nexo.sub")} fullHref="/app/intermediaries">
        {data ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="seg">
                <button type="button" className={view === "sites" ? "seg-on" : ""} onClick={() => setView("sites")}>{t("ot.sitesPrices", { n: data.sites.length })}</button>
                <button type="button" className={view === "people" ? "seg-on" : ""} onClick={() => setView("people")}>{t("ot.people", { n: data.people.length })}</button>
              </div>
            </div>
            <NexoAdd handles={data.people.map((p) => p.handle)} onDone={load} />
            {view === "sites" ? <IntermediariesTable rows={data.sites} compact /> : <PeopleTable rows={data.people} compact />}
          </div>
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel h-10" />)}
          </div>
        )}
      </Drawer>
    </>
  );
}
