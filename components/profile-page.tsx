"use client";
import { useRouter } from "next/navigation";
import { UserProfilePopover } from "./user-profile-popover";
export function ProfilePage({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <UserProfilePopover
      userId={userId}
      displayName="пользователя"
      standalone
      onClose={() => router.push("/app")}
      onOpenDirect={() => router.push(`/app?dm=${encodeURIComponent(userId)}`)}
    />
  );
}
