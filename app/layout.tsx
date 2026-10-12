import type { Metadata } from "next";
import { Onest, Unbounded, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-unbounded" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "LinkBro",
  description: "CRM для команд линкбилдеров",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${onest.variable} ${unbounded.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
