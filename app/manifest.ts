import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FlipZero — пространство для своих",
    short_name: "FlipZero",
    description: "Сообщества, каналы, голосовое общение и события в одном приложении.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f0e13",
    theme_color: "#151319",
    categories: ["social", "productivity", "communication"],
    icons: [
      { src: "/pwa-icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Открыть чаты", short_name: "Чаты", url: "/", icons: [{ src: "/pwa-icon-192.svg", sizes: "192x192", type: "image/svg+xml" }] },
      { name: "Войти в FlipZero", short_name: "Войти", url: "/login", icons: [{ src: "/pwa-icon-192.svg", sizes: "192x192", type: "image/svg+xml" }] },
    ],
  };
}
