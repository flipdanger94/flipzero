import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Создать аккаунт",
  description: "Создайте аккаунт FlipZero и откройте своё пространство для общения.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
