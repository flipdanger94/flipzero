import FlipZeroApp from "@/components/flipzero-app";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginPathFor } from "@/lib/route-access";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ space?: string; channel?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect(loginPathFor("/app"));

  return <FlipZeroApp initialSpaceId={query.space} initialChannelId={query.channel} />;
}
