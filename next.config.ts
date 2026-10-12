import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" собирает компактную версию приложения для Docker (запуск на любом сервере).
  output: "standalone",
};

export default nextConfig;
