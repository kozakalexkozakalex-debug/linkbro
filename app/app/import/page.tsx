import BaseTabs from "@/components/BaseTabs";
import ImportForm from "./ImportForm";
import { getI18n } from "@/lib/i18n/server";

export default async function ImportPage() {
  const { t } = await getI18n();
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BaseTabs />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.import")}</h1>
        <p className="mt-1 max-w-2xl text-mute">
          {t("import.lead")}
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
