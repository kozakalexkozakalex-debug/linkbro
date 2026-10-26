"use client";

// Сохранённые фильтры Confero: один клик — тот же набор условий. Общие для команды.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteFilter, saveFilter } from "./actions";
import { useI18n } from "@/components/I18nProvider";

export default function SavedFilters({ saved, current }: { saved: { id: string; name: string; params: string }[]; current: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {saved.map((f) => (
        <span key={f.id} className="pill inline-flex items-center gap-1">
          <Link href={`/app/global${f.params ? `?${f.params}` : ""}`} className="hover:text-accent">★ {f.name}</Link>
          <button type="button" className="text-mute" aria-label={t("common.delete")} disabled={pending} onClick={() => start(async () => { await deleteFilter(f.id); router.refresh(); })}>✕</button>
        </span>
      ))}
      {current &&
        (open ? (
          <span className="inline-flex items-center gap-1">
            <input aria-label={t("cf.filterName")} className="inp h-8 min-h-0 w-40 py-0 text-sm" placeholder={t("cf.filterName")} value={name} onChange={(e) => setName(e.target.value)} />
            <button
              type="button"
              className="btn btn-sm"
              disabled={pending || !name.trim()}
              onClick={() =>
                start(async () => {
                  await saveFilter(name, current);
                  setName("");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {t("common.save")}
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>☆ {t("cf.saveFilter")}</button>
        ))}
    </div>
  );
}
