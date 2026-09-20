import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  return NextResponse.json({ admin: true, userId: access.user.id });
}
