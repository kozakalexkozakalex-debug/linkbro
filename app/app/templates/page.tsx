import BaseTabs from "@/components/BaseTabs";
import { getTeamContext } from "@/lib/team";
import { getI18n } from "@/lib/i18n/server";
import TemplatesEditor from "./TemplatesEditor";
import type { Template } from "./actions";

export default async function TemplatesPage() {
  const { supabase, team } = await getTeamContext();
  const { t } = await getI18n();
  const { data } = await supabase.from("templates").select("id, kind, name, body").eq("team_id", team.id).order("name");
  return (
    <div className="flex flex-col gap-5">
      <BaseTabs />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.templates")}</h1>
        <p className="mt-1 max-w-2xl text-mute">{t("tpl.lead")}</p>
      </div>
      <TemplatesEditor rows={(data ?? []) as Template[]} />
    </div>
  );
}
