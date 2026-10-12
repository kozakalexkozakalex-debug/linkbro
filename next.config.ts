import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" собирает компактную версию приложения для Docker (запуск на любом сервере).
  output: "standalone",
  // Импорт CSV до 5000 строк передаётся одним запросом
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
