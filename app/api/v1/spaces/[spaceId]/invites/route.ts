import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { invites, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

async function requireInviteManager(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId === user.id) return { database, user, owner: true, permissions: Permission.Administrator };
  const state = await getSpacePermissions(spaceId, user.id);
  if (!state.spaceId || (!hasPermission(state.permissions, Permission.CreateInvites) && !hasPermission(state.permissions, Permission.ManageSpace))) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для управления приглашениями." }, { status: 403 }) };
  return { database, user, owner: false, permissions: state.permissions };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireInviteManager(spaceId);
  if ("error" in access) return access.error;
  const canManageAll = access.owner || hasPermission(access.permissions, Permission.ManageSpace);
  const items = await access.database.select().from(invites).where(canManageAll ? eq(invites.spaceId, spaceId) : and(eq(invites.spaceId, spaceId), eq(invites.creatorId, access.user.id))).orderBy(desc(invites.createdAt));
  return NextResponse.json({ invites: items });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireInviteManager(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => ({}));
  const maxUses = Number.isInteger(body.maxUses) ? Math.min(Math.max(body.maxUses, 1), 100) : 25;
  const days = Number.isInteger(body.days) ? Math.min(Math.max(body.days, 1), 30) : 7;
  const [created] = await access.database.insert(invites).values({ code: randomBytes(9).toString("base64url"), spaceId, creatorId: access.user.id, maxUses, expiresAt: new Date(Date.now() + days * 86400000) }).returning();
  return NextResponse.json({ invite: created }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireInviteManager(spaceId);
  if ("error" in access) return access.error;
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан код приглашения." }, { status: 400 });
  const [invite] = await access.database.select({ creatorId: invites.creatorId }).from(invites).where(and(eq(invites.code, code), eq(invites.spaceId, spaceId))).limit(1);
  if (!invite) return NextResponse.json({ code: "NOT_FOUND", message: "Приглашение не найдено." }, { status: 404 });
  const canManageAll = access.owner || hasPermission(access.permissions, Permission.ManageSpace);
  if (!canManageAll && invite.creatorId !== access.user.id) return NextResponse.json({ code: "FORBIDDEN", message: "Можно удалить только созданное вами приглашение." }, { status: 403 });
  await access.database.delete(invites).where(and(eq(invites.code, code), eq(invites.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
