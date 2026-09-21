import FlipZeroApp from "@/components/flipzero-app";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor("/app"));

  return <FlipZeroApp />;
}
