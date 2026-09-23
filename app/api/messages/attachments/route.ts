import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav",
  "application/pdf", "text/plain", "application/zip",
]);

function attachmentType(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType.startsWith("audio/")) return "audio" as const;
  return "file" as const;
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });

  const access = await getSuperFlipCapabilities(user.id);
  const limitMb = access.active ? 16 : 8;
  const maxBytes = limitMb * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + 512 * 1024) {
    return NextResponse.json({ message: `Файл слишком большой. Максимум ${limitMb} МБ.` }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const durationValue = Number(form?.get("duration") ?? 0);
  if (!(file instanceof File) || !file.size) return NextResponse.json({ message: "Выберите файл." }, { status: 400 });
  if (file.size > maxBytes) return NextResponse.json({ message: `Максимальный размер вложения — ${limitMb} МБ.` }, { status: 413 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ message: "Этот тип файла пока не поддерживается." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  await getDatabase().insert(mediaAssets).values({ id, bytes, contentType: file.type });
  const type = attachmentType(file.type);
  const duration = type === "audio" && Number.isFinite(durationValue) && durationValue > 0 ? Math.min(300, durationValue) : undefined;
  return NextResponse.json({
    attachment: {
      type,
      url: `/api/v1/media/${id}`,
      name: file.name.slice(0, 180),
      mimeType: file.type,
      size: file.size,
      ...(duration ? { duration } : {}),
    },
    limits: { maxBytes, maxMb: limitMb },
  }, { status: 201 });
}
