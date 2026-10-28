import type { MetadataRoute } from "next";

// Значок и название, когда LinkBro добавляют на главный экран телефона
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkBro",
    short_name: "LinkBro",
    start_url: "/app",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
