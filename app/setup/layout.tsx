import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export default async function SetupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/setup"));
  return children;
}
