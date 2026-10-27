import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import I18nProvider from "@/components/I18nProvider";
import { getI18n } from "@/lib/i18n/server";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: "LinkBro", description: t("common.tagline") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getI18n();
  return (
    <html lang={locale} className={`${onest.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
