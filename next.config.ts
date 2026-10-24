import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" собирает компактную версию приложения для Docker (запуск на любом сервере).
  output: "standalone",
  // Импорт CSV до 5000 строк передаётся одним запросом
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Почтовые библиотеки работают только на сервере, не собираем их в общий пакет
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
};

export default nextConfig;
