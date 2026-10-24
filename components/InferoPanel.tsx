"use client";

// Infero — внести домены в Confero: списком (домен и цена) или файлом (CSV / Excel / Ahrefs).
import { useState } from "react";
import InputForm from "@/app/app/input/InputForm";
import ImportForm from "@/app/app/import/ImportForm";
import { useI18n } from "@/components/I18nProvider";

export default function InferoPanel({ initial = "list" }: { initial?: "list" | "file" }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(initial);
  return (
    <div className="flex flex-col gap-4">
      <div className="seg self-start">
        <button type="button" className={mode === "list" ? "seg-on" : ""} onClick={() => setMode("list")}>{t("dom.byList")}</button>
        <button type="button" className={mode === "file" ? "seg-on" : ""} onClick={() => setMode("file")}>{t("dom.byFile")}</button>
      </div>
      <p className="text-sm text-mute">{t(mode === "list" ? "input.lead" : "import.lead")}</p>
      {mode === "list" ? <InputForm /> : <ImportForm />}
    </div>
  );
}
