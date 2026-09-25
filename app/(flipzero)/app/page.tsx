import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export const metadata: Metadata = {
  title: "Приложение",
  description: "FlipZero — чаты, голос, видео и сообщества.",
  robots: { index: false, follow: false },
};

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/app"));

  return null;
}
