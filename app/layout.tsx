import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipZero — пространство для своих",
  description: "Сообщества, живое общение и профиль, который растёт вместе с вами.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
