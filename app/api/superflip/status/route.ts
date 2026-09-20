import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { superflipPurchases, superflipWaitlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const database = getDatabase();
  const [grant] = await database.select().from(superflipPurchases).where(and(eq(superflipPurchases.userId, user.id), isNull(superflipPurchases.revokedAt), or(isNull(superflipPurchases.expiresAt), gt(superflipPurchases.expiresAt, new Date())))).orderBy(desc(superflipPurchases.grantedAt)).limit(1);
  const [waitlist] = await database.select().from(superflipWaitlist).where(eq(superflipWaitlist.userId, user.id)).limit(1);
  return NextResponse.json({ active: Boolean(grant), source: grant?.source ?? null, expiresAt: grant?.expiresAt ?? null, waitlisted: Boolean(waitlist), price: { amount: 4.99, currency: "USD", interval: "month" }, availability: "coming_soon" });
}
