import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const targetTypes = new Set(["user","message","server","channel","profile","media"]);
const reasons = new Set(["spam","abuse","harassment","fraud","unwanted_content","impersonation","other"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const targetType = String(body?.targetType ?? "");
  const targetId = String(body?.targetId ?? "");
  const reason = String(body?.reason ?? "");
  const description = String(body?.description ?? "").trim();
  if (!targetTypes.has(targetType) || !targetId || !reasons.has(reason)) return NextResponse.json({ message: "Некорректная жалоба." }, { status: 400 });
  if (targetType === "user" && targetId === user.id) return NextResponse.json({ message: "Нельзя пожаловаться на себя." }, { status: 400 });
  const id = randomUUID();
  await getDatabase().insert(reports).values({ id, reporterId: user.id, targetType, targetId: targetId.slice(0,200), reason, description: description ? description.slice(0,2000) : null });
  return NextResponse.json({ id, status: "open" }, { status: 201 });
}
