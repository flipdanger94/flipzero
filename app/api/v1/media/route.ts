import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clans, mediaAssets, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { normalizeSpaceBanner } from "@/lib/banner-image";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getClanRole } from "@/lib/clans";

export const runtime = "nodejs";

type ImageKind = "avatar" | "accountBanner" | "spaceIcon" | "spaceBanner" | "clanAvatar" | "clanBanner" | "story";
const kinds: ImageKind[] = ["avatar", "accountBanner", "spaceIcon", "spaceBanner", "clanAvatar", "clanBanner", "story"];
function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const access = await getSuperFlipCapabilities(user.id);
  const requestLimit = Math.max(access.capabilities.avatarUploadMb, access.capabilities.bannerUploadMb) * 1024 * 1024 + 512 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > requestLimit) return NextResponse.json({ message: `Файл слишком большой. Максимум ${Math.max(access.capabilities.avatarUploadMb, access.capabilities.bannerUploadMb)} МБ.` }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if (!kinds.includes(kind as ImageKind) || !(file instanceof File)) return NextResponse.json({ message: "Выберите изображение." }, { status: 400 });
  const imageKind = kind as ImageKind;
  const allowedBytes = imageKind.endsWith("Banner") ? access.capabilities.bannerUploadMb * 1024 * 1024 : access.capabilities.avatarUploadMb * 1024 * 1024;
  if (!file.size || file.size > allowedBytes) return NextResponse.json({ message: `Максимальный размер: ${allowedBytes / 1024 / 1024} МБ${access.active ? " с SuperFlip" : ". SuperFlip увеличивает лимит"}.` }, { status: 413 });

  const database = getDatabase();
  const spaceId = form?.get("spaceId");
  const clanId = form?.get("clanId");
  if (imageKind.startsWith("space")) {
    if (typeof spaceId !== "string") return NextResponse.json({ message: "Сообщество не найдено." }, { status: 400 });
    const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) return NextResponse.json({ message: "Сообщество не найдено." }, { status: 404 });
    if (space.ownerId !== user.id) return NextResponse.json({ message: "Изменять оформление может только владелец." }, { status: 403 });
  }
  if (imageKind.startsWith("clan")) {
    if (typeof clanId !== "string") return NextResponse.json({ message: "Клан не найден." }, { status: 400 });
    const role = await getClanRole(user.id, clanId);
    if (role !== "leader") return NextResponse.json({ message: "Изменять оформление клана может только лидер." }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType || contentType !== file.type) return NextResponse.json({ message: "Поддерживаются PNG, JPEG, WebP и GIF." }, { status: 400 });
  let storedImage = { bytes, contentType };
  if (imageKind === "spaceBanner" || imageKind === "clanBanner") {
    try { storedImage = await normalizeSpaceBanner(bytes, contentType, allowedBytes); }
    catch (reason) { return NextResponse.json({ message: reason instanceof Error ? reason.message : "Не удалось обработать баннер." }, { status: 422 }); }
  }
  const id = randomUUID();
  const url = `/api/v1/media/${id}`;

  const updated = await database.transaction(async (tx) => {
    await tx.insert(mediaAssets).values({ id, bytes: storedImage.bytes, contentType: storedImage.contentType,ownerId:imageKind==="story"?user.id:null,purpose:imageKind==="story"?"story":null });
    if(imageKind==="story")return {story:{url}};
    if (imageKind === "avatar" || imageKind === "accountBanner") {
      const column = imageKind === "avatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: users[column] }).from(users).where(eq(users.id, user.id)).limit(1);
      await tx.update(users).set({ [column]: url, updatedAt: new Date() }).where(eq(users.id, user.id));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { user: { ...user, [column]: url } };
    }
    if (imageKind.startsWith("clan")) {
      const column = imageKind === "clanAvatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: clans[column] }).from(clans).where(eq(clans.id, clanId as string)).limit(1);
      await tx.update(clans).set({ [column]: url, updatedAt: new Date() }).where(eq(clans.id, clanId as string));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { clan: { id: clanId, [column]: url } };
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
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (!kinds.includes(kind)) return NextResponse.json({ message: "Изображение не найдено." }, { status: 400 });
  const imageKind = kind as ImageKind;
  const spaceId = body?.spaceId;
  const clanId = body?.clanId;
  const database = getDatabase();

  if (imageKind.startsWith("space")) {
    if (typeof spaceId !== "string") return NextResponse.json({ message: "Сообщество не найдено." }, { status: 400 });
    const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) return NextResponse.json({ message: "Сообщество не найдено." }, { status: 404 });
    if (space.ownerId !== user.id) return NextResponse.json({ message: "Изменять оформление может только владелец." }, { status: 403 });
  }
  if (imageKind.startsWith("clan")) {
    if (typeof clanId !== "string") return NextResponse.json({ message: "Клан не найден." }, { status: 400 });
    const role = await getClanRole(user.id, clanId);
    if (role !== "leader") return NextResponse.json({ message: "Изменять оформление клана может только лидер." }, { status: 403 });
  }

  const result = await database.transaction(async (tx) => {
    if (imageKind === "avatar" || imageKind === "accountBanner") {
      const column = imageKind === "avatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: users[column] }).from(users).where(eq(users.id, user.id)).limit(1);
      await tx.update(users).set({ [column]: null, updatedAt: new Date() }).where(eq(users.id, user.id));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { user: { ...user, [column]: null } };
    }
    if (imageKind.startsWith("clan")) {
      const column = imageKind === "clanAvatar" ? "avatarUrl" : "bannerUrl";
      const [previous] = await tx.select({ url: clans[column] }).from(clans).where(eq(clans.id, clanId as string)).limit(1);
      await tx.update(clans).set({ [column]: null, updatedAt: new Date() }).where(eq(clans.id, clanId as string));
      if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
      return { clan: { id: clanId, [column]: null } };
    }
    const column = imageKind === "spaceIcon" ? "iconUrl" : "bannerUrl";
    const [previous] = await tx.select({ url: spaces[column] }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    await tx.update(spaces).set({ [column]: null, updatedAt: new Date() }).where(eq(spaces.id, spaceId));
    if (previous?.url?.startsWith("/api/v1/media/")) await tx.delete(mediaAssets).where(eq(mediaAssets.id, previous.url.slice("/api/v1/media/".length)));
    return { space: { id: spaceId, [column]: null } };
  });
  return NextResponse.json(result);
}
