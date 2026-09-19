import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type ImageKind = "avatar" | "accountBanner" | "spaceIcon" | "spaceBanner";
const kinds: ImageKind[] = ["avatar", "accountBanner", "spaceIcon", "spaceBanner"];
const maxBytes = (kind: ImageKind) => kind.endsWith("Banner") ? 4 * 1024 * 1024 : 2 * 1024 * 1024;

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) return NextResponse.json({ message: "Файл слишком большой." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if (!kinds.includes(kind as ImageKind) || !(file instanceof File)) return NextResponse.json({ message: "Выберите изображение." }, { status: 400 });
  const imageKind = kind as ImageKind;
  if (!file.size || file.size > maxBytes(imageKind)) return NextResponse.json({ message: `Максимальный размер: ${maxBytes(imageKind) / 1024 / 1024} МБ.` }, { status: 413 });

  const database = getDatabase();
  const spaceId = form?.get("spaceId");
  if (imageKind.startsWith("space")) {
    if (typeof spaceId !== "string") return NextResponse.json({ message: "Сообщество не найдено." }, { status: 400 });
    const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) return NextResponse.json({ message: "Сообщество не найдено." }, { status: 404 });
    if (space.ownerId !== user.id) return NextResponse.json({ message: "Изменять оформление может только владелец." }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType || contentType !== file.type) return NextResponse.json({ message: "Поддерживаются PNG, JPEG, WebP и GIF." }, { status: 400 });
  const id = randomUUID();
  const url = `/api/v1/media/${id}`;

  const updated = await database.transaction(async (tx) => {
    await tx.insert(mediaAssets).values({ id, bytes, contentType });
    if (imageKind === "avatar" || imageKind === "accountBanner") {
      const column = imageKind === "avatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: users[column] }).from(users).where(eq(users.id, user.id)).limit(1);
      await tx.update(users).set({ [column]: url, updatedAt: new Date() }).where(eq(users.id, user.id));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { user: { ...user, [column]: url } };
    }
    const column = imageKind === "spaceIcon" ? "iconUrl" : "bannerUrl";
    const [previous] = await tx.select({ url: spaces[column] }).from(spaces).where(eq(spaces.id, spaceId as string)).limit(1);
    await tx.update(spaces).set({ [column]: url, updatedAt: new Date() }).where(eq(spaces.id, spaceId as string));
    if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
    return { space: { id: spaceId, [column]: url } };
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (!kinds.includes(kind)) return NextResponse.json({ message: "Изображение не найдено." }, { status: 400 });
  const imageKind = kind as ImageKind;
  const spaceId = body?.spaceId;
  const database = getDatabase();

  if (imageKind.startsWith("space")) {
    if (typeof spaceId !== "string") return NextResponse.json({ message: "Сообщество не найдено." }, { status: 400 });
    const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) return NextResponse.json({ message: "Сообщество не найдено." }, { status: 404 });
    if (space.ownerId !== user.id) return NextResponse.json({ message: "Изменять оформление может только владелец." }, { status: 403 });
  }

  const result = await database.transaction(async (tx) => {
    if (imageKind === "avatar" || imageKind === "accountBanner") {
      const column = imageKind === "avatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: users[column] }).from(users).where(eq(users.id, user.id)).limit(1);
      await tx.update(users).set({ [column]: null, updatedAt: new Date() }).where(eq(users.id, user.id));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { user: { ...user, [column]: null } };
    }
    const column = imageKind === "spaceIcon" ? "iconUrl" : "bannerUrl";
    const [previous] = await tx.select({ url: spaces[column] }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    await tx.update(spaces).set({ [column]: null, updatedAt: new Date() }).where(eq(spaces.id, spaceId));
    if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
    return { space: { id: spaceId, [column]: null } };
  });
  return NextResponse.json(result);
}
