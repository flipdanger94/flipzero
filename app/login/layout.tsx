import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в FlipZero",
  description: "Войди в аккаунт FlipZero, чтобы продолжить общение.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
