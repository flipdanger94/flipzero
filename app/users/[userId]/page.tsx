import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfilePage } from "@/components/profile-page";
export default async function UserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!(await getCurrentUser()))
    redirect(`/login?next=${encodeURIComponent(`/users/${userId}`)}`);
  return <ProfilePage userId={userId} />;
}
