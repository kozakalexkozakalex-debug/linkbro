"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate, saveTemplate, type Template } from "./actions";
import { useI18n } from "@/components/I18nProvider";

function Item({ tpl, onDone }: { tpl: Partial<Template> & { kind: "message" | "brief" }; onDone: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(tpl.name ?? "");
  const [body, setBody] = useState(tpl.body ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <input aria-label={t("proj.name")} className="inp" placeholder={t("tpl.namePh")} value={name} onChange={(e) => setName(e.target.value)} />
      <textarea aria-label={t("tpl.body")} className="inp min-h-32 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-pri btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTemplate({ id: tpl.id, kind: tpl.kind, name, body });
              setMsg(r.ok ? { text: t("common.saved") } : { text: r.error, bad: true });
              if (r.ok) {
                if (!tpl.id) {
                  setName("");
                  setBody("");
                }
                onDone();
              }
            })
          }
        >
          {tpl.id ? t("common.save") : t("common.add")}
        </button>
        {tpl.id && (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await deleteTemplate(tpl.id as string); onDone(); })}>
            {t("common.delete")}
          </button>
        )}
        {msg && <span className={`text-sm ${msg.bad ? "text-bad" : "text-mute"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function TemplatesEditor({ rows }: { rows: Template[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const refresh = () => router.refresh();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["message", "brief"] as const).map((kind) => (
        <section key={kind} className="card flex flex-col gap-3">
          <div>
            <p className="lbl">{kind === "message" ? t("tpl.messages") : t("tpl.briefs")}</p>
            <p className="mt-1 text-sm text-mute">{t("tpl.vars")}</p>
          </div>
          {rows.filter((r) => r.kind === kind).map((r) => <Item key={r.id} tpl={r} onDone={refresh} />)}
          <p className="lbl">{t("tpl.new")}</p>
          <Item tpl={{ kind }} onDone={refresh} />
        </section>
      ))}
    </div>
  );
}
