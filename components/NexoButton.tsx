"use client";

// Кнопка «Nexo» в Outreach: база посередників выезжает справа (как Infero в Confero).
// Полная страница — по стрелке ↗ в шапке панели.
import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import Icon from "@/components/Icon";
import PeopleTable, { type PersonRow } from "@/app/app/intermediaries/PeopleTable";
import { getNexoPeople } from "@/app/app/intermediaries/nexo-actions";
import { useI18n } from "@/components/I18nProvider";

export default function NexoButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || rows) return;
    getNexoPeople()
      .then(setRows)
      .catch(() => setRows([]));
  }, [open, rows]);

  return (
    <>
      <button type="button" className="nexo-btn" onClick={() => setOpen(true)} title={t("nexo.sub")}>
        <Icon name="users" size={15} />
        Nexo
      </button>
      <Drawer open={open} onClose={close} title="Nexo" sub={t("nexo.sub")} fullHref="/app/intermediaries">
        {rows ? (
          <PeopleTable rows={rows} compact />
        ) : (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel h-10" />)}
          </div>
        )}
      </Drawer>
    </>
  );
}
