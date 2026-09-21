import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, reports } from "@/db/schema";
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
  const db=getDatabase();
  const [existing]=await db.select().from(reports).where(eq(reports.id,id)).limit(1);
  if(!existing)return NextResponse.json({message:"Жалоба не найдена."},{status:404});
  const moderatorNote=body?.moderatorNote ? String(body.moderatorNote).slice(0,1000) : null;
  await db.transaction(async tx=>{
    await tx.update(reports).set({ status, assignedModeratorId: access.user.id, moderatorNote, resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null }).where(eq(reports.id,id));
    await tx.insert(adminAuditLogs).values({id:randomUUID(),adminId:access.user.id,action:`report.${status}`,metadata:{reportId:id,previousStatus:existing.status,targetType:existing.targetType,targetId:existing.targetId,moderatorNote}});
  });
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
