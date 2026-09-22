import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { boardItems, channels, members } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

async function access(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [channel] = await database.select({ id: channels.id }).from(channels)
    .innerJoin(members, and(eq(members.spaceId, channels.spaceId), eq(members.userId, user.id)))
    .where(and(eq(channels.id, channelId), eq(channels.kind, "board")))
    .limit(1);
  if (!channel) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Доска недоступна." }, { status: 403 }) };
  const state = await getChannelPermissions(channelId, user.id);
  if (!state.spaceId || !hasPermission(state.permissions, Permission.ViewChannels)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Доска недоступна." }, { status: 403 }) };
  return { database, user, permissions: state.permissions };
}

function requireBoardWrite(permissions: number) {
  return hasPermission(permissions, Permission.SendMessages);
}

export async function GET(_: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const result = await access(channelId);
  if ("error" in result) return result.error;
  const items = await result.database.select().from(boardItems).where(eq(boardItems.channelId, channelId)).orderBy(asc(boardItems.position), asc(boardItems.createdAt));
  const canWrite = requireBoardWrite(result.permissions);
  const canManage = hasPermission(result.permissions, Permission.ManageMessages);
  return NextResponse.json({
    capabilities: { write: canWrite, manageMessages: canManage },
    items: items.map((item) => ({ ...item, canDelete: item.authorId === result.user.id || canManage })),
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) { const { channelId } = await params; const result = await access(channelId); if ("error" in result) return result.error; if (!requireBoardWrite(result.permissions)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права добавлять карточки в эту доску." }, { status: 403 }); const body = await request.json().catch(() => null); const title = String(body?.title ?? "").trim().slice(0, 120); if (!title) return NextResponse.json({ message: "Введите название карточки." }, { status: 400 }); const [item] = await result.database.insert(boardItems).values({ id: randomUUID(), channelId, authorId: result.user.id, title, description: String(body?.description ?? "").trim().slice(0, 500) || null }).returning(); return NextResponse.json({ item }, { status: 201 }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string }> }) { const { channelId } = await params; const result = await access(channelId); if ("error" in result) return result.error; if (!requireBoardWrite(result.permissions)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права изменять карточки в этой доске." }, { status: 403 }); const body = await request.json().catch(() => null); const status = ["todo", "progress", "done"].includes(body?.status) ? body.status : null; if (!status) return NextResponse.json({ message: "Неизвестный статус." }, { status: 400 }); await result.database.update(boardItems).set({ status, updatedAt: new Date() }).where(and(eq(boardItems.id, String(body.id)), eq(boardItems.channelId, channelId))); return NextResponse.json({ status }); }
export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const result = await access(channelId);
  if ("error" in result) return result.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const [item] = await result.database.select({ authorId: boardItems.authorId }).from(boardItems).where(and(eq(boardItems.id, id), eq(boardItems.channelId, channelId))).limit(1);
  if (!item) return NextResponse.json({ code: "NOT_FOUND", message: "Карточка не найдена." }, { status: 404 });
  if (item.authorId !== result.user.id && !hasPermission(result.permissions, Permission.ManageMessages)) return NextResponse.json({ code: "FORBIDDEN", message: "Удалять чужие карточки может только модератор." }, { status: 403 });
  await result.database.delete(boardItems).where(and(eq(boardItems.id, id), eq(boardItems.channelId, channelId)));
  return NextResponse.json({ ok: true });
}
