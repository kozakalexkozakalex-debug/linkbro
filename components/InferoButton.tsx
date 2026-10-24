"use client";

// Кнопка «+ Infero»: открывает панель справа с добавлением доменов
import { useCallback, useState } from "react";
import Drawer from "@/components/Drawer";
import InferoPanel from "@/components/InferoPanel";
import { useI18n } from "@/components/I18nProvider";

export default function InferoButton({ className = "btn btn-pri btn-sm" }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        + Infero
      </button>
      <Drawer open={open} onClose={close} title="Infero" sub={t("dom.inferoSub")} fullHref="/app/input">
        <InferoPanel />
      </Drawer>
    </>
  );
}
