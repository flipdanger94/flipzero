import { type Metadata } from "next";
import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SetupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/setup"));
  return children;
}
