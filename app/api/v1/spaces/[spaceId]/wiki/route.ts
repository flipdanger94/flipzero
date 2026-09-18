import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, spaces, wikiPages, wikiRevisions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireMember(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [membership] = await database.select({ ownerId: spaces.ownerId }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 }) };
  return { database, user, isOwner: membership.ownerId === user.id };
}

function pageInput(body: Record<string, unknown> | null) {
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim().slice(0, 240) : "";
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 20000) : "";
  return { title, summary, content };
}

function makeSlug(title: string) {
  const base = title.toLocaleLowerCase("ru").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 50) || "page";
  return `${base}-${randomUUID().slice(0, 5)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  const pageId = new URL(request.url).searchParams.get("history");
  if (pageId) {
    const revisions = await access.database.select({ id: wikiRevisions.id, revision: wikiRevisions.revision, title: wikiRevisions.title, createdAt: wikiRevisions.createdAt }).from(wikiRevisions).innerJoin(wikiPages, eq(wikiPages.id, wikiRevisions.pageId)).where(and(eq(wikiRevisions.pageId, pageId), eq(wikiPages.spaceId, spaceId))).orderBy(desc(wikiRevisions.revision)).limit(50);
    return NextResponse.json({ revisions });
  }
  const pages = await access.database.select().from(wikiPages).where(eq(wikiPages.spaceId, spaceId)).orderBy(desc(wikiPages.updatedAt)).limit(100);
  return NextResponse.json({ pages, isOwner: access.isOwner });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  if (!access.isOwner) return NextResponse.json({ code: "FORBIDDEN", message: "Создавать статьи может только владелец." }, { status: 403 });
  const input = pageInput(await request.json().catch(() => null));
  if (input.title.length < 2 || input.content.length < 10) return NextResponse.json({ code: "INVALID_INPUT", message: "Добавьте название и текст статьи." }, { status: 400 });
  const pageId = randomUUID();
  const [page] = await access.database.transaction(async (tx) => {
    const created = await tx.insert(wikiPages).values({ id: pageId, spaceId, authorId: access.user.id, slug: makeSlug(input.title), title: input.title, summary: input.summary || null, content: input.content }).returning();
    await tx.insert(wikiRevisions).values({ id: randomUUID(), pageId, editorId: access.user.id, revision: 1, title: input.title, summary: input.summary || null, content: input.content });
    return created;
  });
  return NextResponse.json({ page }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  if (!access.isOwner) return NextResponse.json({ code: "FORBIDDEN", message: "Редактировать статьи может только владелец." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const input = pageInput(body);
  if (typeof body?.id !== "string" || input.title.length < 2 || input.content.length < 10) return NextResponse.json({ code: "INVALID_INPUT", message: "Добавьте название и текст статьи." }, { status: 400 });
  const [current] = await access.database.select({ id: wikiPages.id, revision: wikiPages.revision }).from(wikiPages).where(and(eq(wikiPages.id, body.id), eq(wikiPages.spaceId, spaceId))).limit(1);
  if (!current) return NextResponse.json({ code: "NOT_FOUND", message: "Статья не найдена." }, { status: 404 });
  const revision = current.revision + 1;
  const [page] = await access.database.transaction(async (tx) => {
    const updated = await tx.update(wikiPages).set({ title: input.title, summary: input.summary || null, content: input.content, revision, updatedAt: new Date() }).where(eq(wikiPages.id, current.id)).returning();
    await tx.insert(wikiRevisions).values({ id: randomUUID(), pageId: current.id, editorId: access.user.id, revision, title: input.title, summary: input.summary || null, content: input.content });
    return updated;
  });
  return NextResponse.json({ page });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  if ("error" in access) return access.error;
  if (!access.isOwner) return NextResponse.json({ code: "FORBIDDEN", message: "Удалять статьи может только владелец." }, { status: 403 });
  const pageId = new URL(request.url).searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ code: "INVALID_INPUT", message: "Статья не выбрана." }, { status: 400 });
  await access.database.delete(wikiPages).where(and(eq(wikiPages.id, pageId), eq(wikiPages.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
