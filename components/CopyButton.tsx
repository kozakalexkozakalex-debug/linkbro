"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";

export default function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-sm">
      {copied ? t("common.copied") : t("common.copy")}
    </button>
  );
}
