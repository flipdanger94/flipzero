import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaClient } from "./pwa-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipZero — пространство для своих",
  description: "Сообщества, живое общение и профиль, который растёт вместе с вами.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/pwa-icon-192.svg",
  },
  applicationName: "FlipZero",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FlipZero" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#151319" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}<PwaClient /><Analytics /><SpeedInsights /></body>
    </html>
  );
}
