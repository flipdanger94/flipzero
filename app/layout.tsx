import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaClient } from "./pwa-client";
import "./forum.css";
import "./chat-rich.css";
import "./voice-room.css";
import "./community-dialogs.css";
import "./developer.css";
import "./app-shell.css";
import "./trust-safety.css";
import "./pwa.css";
import "./system-status.css";
import "./security-hardening.css";
import "./social.css";
import "./platform-shell.css";
import "./ui-audit.css";
import "./landing.css";
import "./globals.css";
import "./product-theme.css";
import "./neon-redesign.css";
import "./community.css";
import "./account-settings.css";
import "./clans.css";
import "./mobile.css";
import "./runtime-theme.css";
import "./themes.css";
import "./store.css";
import "./design-system.css";
import "./mobile-discord.css";
import "./marketing.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flipzeroapp.vercel.app"),
  title: {
    default: "FlipZero — чаты, голос и сообщества",
    template: "%s | FlipZero",
  },
  description: "Общайтесь в текстовых и голосовых каналах, проводите события и развивайте своё сообщество в FlipZero.",
  alternates: {
    languages: { "ru": "/" },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "FlipZero",
    title: "FlipZero — чаты, голос и сообщества",
    description: "Общайтесь в текстовых и голосовых каналах, проводите события и развивайте своё сообщество в FlipZero.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "FlipZero — чаты, голос и сообщества" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  applicationName: "FlipZero",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FlipZero" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#151319" };

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
