import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { invites, memberRoles, members, moderationCases, roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const database = getDatabase();
  const [invite] = await database.select({ code: invites.code, spaceId: spaces.id, spaceName: spaces.name, description: spaces.description, accentColor: spaces.accentColor, uses: invites.uses, maxUses: invites.maxUses, expiresAt: invites.expiresAt }).from(invites).innerJoin(spaces, eq(invites.spaceId, spaces.id)).where(eq(invites.code, code)).limit(1);
  if (!invite) return NextResponse.json({ code: "NOT_FOUND", message: "Приглашение не найдено." }, { status: 404 });
  const unavailable = (invite.expiresAt && invite.expiresAt <= new Date()) || (invite.maxUses !== null && invite.uses >= invite.maxUses);
  return NextResponse.json({ invite: { ...invite, unavailable } });
}

export async function POST(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const [user, { code }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Войдите, чтобы принять приглашение." }, { status: 401 });
  const database = getDatabase();
  const [invite] = await database.select().from(invites).where(and(eq(invites.code, code), or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())))).limit(1);
  if (!invite || (invite.maxUses !== null && invite.uses >= invite.maxUses)) return NextResponse.json({ code: "INVITE_UNAVAILABLE", message: "Приглашение истекло или уже использовано максимальное число раз." }, { status: 410 });
  const [latestBanAction] = await database.select({ action: moderationCases.action }).from(moderationCases).where(and(eq(moderationCases.spaceId, invite.spaceId), eq(moderationCases.targetUserId, user.id), or(eq(moderationCases.action, "ban"), eq(moderationCases.action, "unban")))).orderBy(desc(moderationCases.createdAt)).limit(1);
  if (latestBanAction?.action === "ban") return NextResponse.json({ code: "BANNED", message: "Вы заблокированы в этом пространстве." }, { status: 403 });
  const [existing] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, invite.spaceId))).limit(1);
  if (existing) return NextResponse.json({ spaceId: invite.spaceId, joined: false });
  const [memberRole] = await database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, invite.spaceId), eq(roles.name, "Участник"), eq(roles.isManaged, true))).limit(1);
  let joined = false;
  try {
    await database.transaction(async (tx) => {
      const inserted = await tx.insert(members).values({ userId: user.id, spaceId: invite.spaceId }).onConflictDoNothing().returning({ userId: members.userId });
      if (!inserted.length) return;
      const [reserved] = await tx.update(invites).set({ uses: sql`${invites.uses} + 1` }).where(and(
        eq(invites.code, code),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
        or(isNull(invites.maxUses), sql`${invites.uses} < ${invites.maxUses}`),
      )).returning({ code: invites.code });
      if (!reserved) throw new Error("INVITE_UNAVAILABLE");
      if (memberRole) await tx.insert(memberRoles).values({ userId: user.id, spaceId: invite.spaceId, roleId: memberRole.id }).onConflictDoNothing();
      joined = true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITE_UNAVAILABLE") return NextResponse.json({ code: "INVITE_UNAVAILABLE", message: "Приглашение истекло или уже использовано максимальное число раз." }, { status: 410 });
    throw error;
  }
  return NextResponse.json({ spaceId: invite.spaceId, joined });
}
