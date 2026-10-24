import { getI18n } from "@/lib/i18n/server";
import { getMailInfo } from "./actions";
import MailSettings from "./MailSettings";

export default async function MailPage() {
  const [{ t }, info] = await Promise.all([getI18n(), getMailInfo()]);
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("nav.mail")}</h1>
        <p className="mt-1 max-w-2xl text-mute">{t("mail.lead")}</p>
      </div>
      <MailSettings info={info} />
    </div>
  );
}
