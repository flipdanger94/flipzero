import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasAdminRole } from "@/lib/access";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  if (!hasAdminRole(user)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Требуется роль администратора." }, { status: 403 }) };
  return { user };
}
