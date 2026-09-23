import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets, members, spaces, spaceSounds } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

async function access(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "Требуется вход." }, { status: 401 }) };
  const db = getDatabase();
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ message: "Пространство не найдено." }, { status: 404 }) };
  const [membership] = await db.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1);
  if (!membership && space.ownerId !== user.id) return { error: NextResponse.json({ message: "Нужен доступ к пространству." }, { status: 403 }) };
  return { db, owner: space.ownerId === user.id };
}

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  const sounds = await result.db.select({ id: spaceSounds.id, name: spaceSounds.name, assetId: spaceSounds.assetId }).from(spaceSounds).where(eq(spaceSounds.spaceId, spaceId));
  return NextResponse.json({ sounds: sounds.map(({ id, name, assetId }) => ({ id, name, url: `/api/v1/media/${assetId}` })), owner: result.owner });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  if (!result.owner) return NextResponse.json({ message: "Добавлять звуки может владелец." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2_500_000) return NextResponse.json({ message: "Звук должен быть меньше 2 МБ." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const name = String(form?.get("name") ?? "").trim();
  if (!(file instanceof File) || !name || name.length > 48 || !file.size || file.size > 2_000_000) return NextResponse.json({ message: "Укажите имя и файл до 2 МБ." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = bytes.subarray(0, 4).toString("ascii") === "OggS" ? "audio/ogg" : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE" ? "audio/wav" : bytes.subarray(0, 3).toString("ascii") === "ID3" || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 ? "audio/mpeg" : null;
  if (!type || (file.type && ![type, ...(type === "audio/mpeg" ? ["audio/mp3"] : [])].includes(file.type))) return NextResponse.json({ message: "Поддерживаются MP3, OGG и WAV." }, { status: 400 });
  const [count] = await result.db.select({ value: sql<number>`count(*)::int` }).from(spaceSounds).where(eq(spaceSounds.spaceId, spaceId));
  if (count.value >= 12) return NextResponse.json({ message: "Можно сохранить не более 12 звуков." }, { status: 409 });
  const id = randomUUID(), assetId = randomUUID();
  await result.db.transaction(async (tx) => { await tx.insert(mediaAssets).values({ id: assetId, contentType: type, bytes }); await tx.insert(spaceSounds).values({ id, spaceId, assetId, name }); });
  return NextResponse.json({ sound: { id, name, url: `/api/v1/media/${assetId}` } }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  if (!result.owner) return NextResponse.json({ message: "Удалять звуки может владелец." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const [sound] = await result.db.select({ assetId: spaceSounds.assetId }).from(spaceSounds).where(and(eq(spaceSounds.id, id), eq(spaceSounds.spaceId, spaceId))).limit(1);
  if (!sound) return NextResponse.json({ message: "Звук не найден." }, { status: 404 });
  await result.db.transaction(async (tx) => { await tx.delete(spaceSounds).where(eq(spaceSounds.id, id)); await tx.delete(mediaAssets).where(eq(mediaAssets.id, sound.assetId)); });
  return NextResponse.json({ ok: true });
}
