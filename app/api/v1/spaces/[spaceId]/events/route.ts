import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { communityEvents, eventAttendees, members, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireMember(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [membership] = await database.select({ ownerId: spaces.ownerId }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 }) };
  return { database, user, isOwner: membership.ownerId === user.id };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  const items = await access.database.select({ id: communityEvents.id, title: communityEvents.title, description: communityEvents.description, location: communityEvents.location, startsAt: communityEvents.startsAt, endsAt: communityEvents.endsAt, capacity: communityEvents.capacity, attendeeCount: sql<number>`count(${eventAttendees.userId})::int` }).from(communityEvents).leftJoin(eventAttendees, eq(eventAttendees.eventId, communityEvents.id)).where(and(eq(communityEvents.spaceId, spaceId), gte(communityEvents.startsAt, new Date(Date.now() - 6 * 60 * 60 * 1000)))).groupBy(communityEvents.id).orderBy(asc(communityEvents.startsAt)).limit(50);
  const attending = await access.database.select({ eventId: eventAttendees.eventId }).from(eventAttendees).innerJoin(communityEvents, eq(communityEvents.id, eventAttendees.eventId)).where(and(eq(communityEvents.spaceId, spaceId), eq(eventAttendees.userId, access.user.id)));
  const attendingIds = new Set(attending.map((item) => item.eventId));
  return NextResponse.json({ events: items.map((item) => ({ ...item, attending: attendingIds.has(item.id) })), isOwner: access.isOwner });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (body?.action === "attend") {
    if (typeof body.eventId !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Событие не выбрано." }, { status: 400 });
    const [event] = await access.database.select({ id: communityEvents.id, capacity: communityEvents.capacity }).from(communityEvents).where(and(eq(communityEvents.id, body.eventId), eq(communityEvents.spaceId, spaceId))).limit(1);
    if (!event) return NextResponse.json({ code: "NOT_FOUND", message: "Событие не найдено." }, { status: 404 });
    if (body.attending === false) {
      await access.database.delete(eventAttendees).where(and(eq(eventAttendees.eventId, event.id), eq(eventAttendees.userId, access.user.id)));
      return NextResponse.json({ attending: false });
    }
    const [{ count }] = await access.database.select({ count: sql<number>`count(*)::int` }).from(eventAttendees).where(eq(eventAttendees.eventId, event.id));
    if (event.capacity !== null && count >= event.capacity) return NextResponse.json({ code: "EVENT_FULL", message: "Все места на событие уже заняты." }, { status: 409 });
    await access.database.insert(eventAttendees).values({ eventId: event.id, userId: access.user.id }).onConflictDoNothing();
    return NextResponse.json({ attending: true });
  }
  if (!access.isOwner) return NextResponse.json({ code: "FORBIDDEN", message: "Создавать события может только владелец." }, { status: 403 });
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 500) : "";
  const location = typeof body?.location === "string" ? body.location.trim().slice(0, 120) : "";
  const startsAt = new Date(body?.startsAt);
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
  const capacity = body?.capacity ? Number(body.capacity) : null;
  if (!title || Number.isNaN(startsAt.getTime()) || startsAt <= new Date() || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) || (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000))) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название, дату и количество мест." }, { status: 400 });
  const [event] = await access.database.insert(communityEvents).values({ id: randomUUID(), spaceId, creatorId: access.user.id, title, description: description || null, location: location || null, startsAt, endsAt, capacity }).returning();
  await access.database.insert(eventAttendees).values({ eventId: event.id, userId: access.user.id });
  return NextResponse.json({ event: { ...event, attendeeCount: 1, attending: true } }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  if (!access.isOwner) return NextResponse.json({ code: "FORBIDDEN", message: "Удалять события может только владелец." }, { status: 403 });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ code: "INVALID_INPUT", message: "Событие не выбрано." }, { status: 400 });
  await access.database.delete(communityEvents).where(and(eq(communityEvents.id, eventId), eq(communityEvents.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
