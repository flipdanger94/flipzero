import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelCategories, channels, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const db = getDatabase();
  const [space] = await db.select({ ownerId: spaces.ownerId, name: spaces.name }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) return NextResponse.json({ message: "Шаблон доступен владельцу пространства." }, { status: 403 });
  const [categories, channelRows] = await Promise.all([
    db.select({ id: channelCategories.id, name: channelCategories.name }).from(channelCategories).where(eq(channelCategories.spaceId, spaceId)).orderBy(asc(channelCategories.position)),
    db.select({ name: channels.name, topic: channels.topic, kind: channels.kind, parentId: channels.parentId }).from(channels).where(eq(channels.spaceId, spaceId)).orderBy(asc(channels.position)),
  ]);
  return NextResponse.json({ version: 1, categories: categories.map(({ name }) => ({ name })), channels: channelRows.map(({ name, topic, kind, parentId }) => ({ name, topic, kind, category: categories.find((category) => category.id === parentId)?.name ?? null })) }, { headers: { "cache-control": "private, no-store" } });
}
