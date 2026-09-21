import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export default async function InviteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ code: string }>;
}) {
  const [{ code }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect(loginPathFor(`/invite/${encodeURIComponent(code)}`));
  return children;
}
