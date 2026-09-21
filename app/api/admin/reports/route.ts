import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { reports } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const rows = await getDatabase().select().from(reports).orderBy(desc(reports.createdAt)).limit(200);
  return NextResponse.json({ reports: rows });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "");
  const status = String(body?.status ?? "");
  if (!id || !["open","reviewing","resolved","rejected"].includes(status)) return NextResponse.json({ message: "Некорректные данные." }, { status: 400 });
  await getDatabase().update(reports).set({ status, assignedModeratorId: access.user.id, moderatorNote: body?.moderatorNote ? String(body.moderatorNote).slice(0,1000) : null, resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null }).where(eq(reports.id,id));
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const targetType = String(body?.targetType ?? "");
  const targetId = String(body?.targetId ?? "");
  const reason = String(body?.reason ?? "");
  if (!targetType || !targetId || !reason) return NextResponse.json({ message: "Заполните обязательные поля." }, { status: 400 });
  const id = randomUUID();
  await getDatabase().insert(reports).values({ id, reporterId: access.user.id, targetType, targetId, reason: reason.slice(0,120), description: body?.description ? String(body.description).slice(0,2000) : null });
  return NextResponse.json({ id }, { status: 201 });
}
