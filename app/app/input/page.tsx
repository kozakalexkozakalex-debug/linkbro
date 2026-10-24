import BaseTabs from "@/components/BaseTabs";
import InputForm from "./InputForm";
import { getI18n } from "@/lib/i18n/server";

export default async function InputPage() {
  const { t } = await getI18n();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BaseTabs />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.input")}</h1>
        <p className="mt-1 text-mute">{t("input.lead")}</p>
      </div>
      <InputForm />
    </div>
  );
}
