import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, channelNotificationSettings, members, messages, moderationCases, moderationFlags, reactions, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dispatchDeveloperEvent } from "@/lib/developer-webhooks";
import { assessMessageSafety } from "@/lib/trust-safety";
import { getChannelPermissions, hasPermission, SpacePermission } from "@/lib/space-permissions";
import { isTrustedMutationRequest } from "@/lib/security-controls";

const untrusted = () => NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён. Обновите страницу и попробуйте снова." }, { status: 403 });

async function accessChannel(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [channel] = await database.select({ id: channels.id, spaceId: channels.spaceId, kind: channels.kind, ownerId: spaces.ownerId }).from(channels).innerJoin(spaces, eq(spaces.id, channels.spaceId)).innerJoin(members, and(eq(members.spaceId, channels.spaceId), eq(members.userId, user.id))).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Канал недоступен." }, { status: 403 }) };
  const permissionState = await getChannelPermissions(channelId, user.id);
  if (!permissionState.owner && !hasPermission(permissionState.permissions, SpacePermission.ViewChannels)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Нет права на просмотр канала." }, { status: 403 }) };
  return { database, user, channel, permissions: permissionState.permissions, owner: permissionState.owner };
}

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params; const access = await accessChannel(channelId); if ("error" in access) return access.error;
  const url = new URL(request.url); const query = url.searchParams.get("q")?.trim(); const pinned = url.searchParams.get("pinned") === "1"; const threadRootId = url.searchParams.get("threadRootId");
  const conditions = [eq(messages.channelId, channelId), isNull(messages.deletedAt)];
  if (query) conditions.push(or(ilike(messages.content, `%${query}%`), ilike(users.displayName, `%${query}%`))!);
  if (pinned) conditions.push(sql`${messages.pinnedAt} IS NOT NULL`);
  if (threadRootId) conditions.push(eq(messages.threadRootId, threadRootId)); else conditions.push(isNull(messages.threadRootId));
  const rows = await access.database.select({ id: messages.id, content: messages.content, attachments: messages.attachments, replyToId: messages.replyToId, threadRootId: messages.threadRootId, editedAt: messages.editedAt, pinnedAt: messages.pinnedAt, createdAt: messages.createdAt, authorId: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl }).from(messages).innerJoin(users, eq(users.id, messages.authorId)).where(and(...conditions)).orderBy(threadRootId ? asc(messages.createdAt) : desc(messages.createdAt)).limit(100);
  const ids = rows.map((row) => row.id); const reactionRows = ids.length ? await access.database.select().from(reactions).where(inArray(reactions.messageId, ids)) : [];
  return NextResponse.json({
    messages: (threadRootId ? rows : rows.reverse()).map((row) => ({ ...row, reactions: reactionRows.filter((item) => item.messageId === row.id) })),
    permissions: {
      canSend: (access.channel.kind !== "announcement" || access.channel.ownerId === access.user.id) && (access.owner || hasPermission(access.permissions, SpacePermission.SendMessages)),
      canReact: access.owner || hasPermission(access.permissions, SpacePermission.AddReactions),
      canAttach: access.owner || hasPermission(access.permissions, SpacePermission.AttachFiles),
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return untrusted();
  const { channelId } = await params; const access = await accessChannel(channelId); if ("error" in access) return access.error; const body = await request.json().catch(() => null);
  if (body?.action === "react") { if (!access.owner && !hasPermission(access.permissions, SpacePermission.AddReactions)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права добавлять реакции." }, { status: 403 }); const emoji = String(body.emoji ?? "").slice(0, 16); const messageId = String(body.messageId ?? ""); if (!emoji || !messageId) return NextResponse.json({ message: "Реакция не указана." }, { status: 400 }); const [target] = await access.database.select({ id: messages.id }).from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId), isNull(messages.deletedAt))).limit(1); if (!target) return NextResponse.json({ code: "NOT_FOUND", message: "Сообщение не найдено в этом канале." }, { status: 404 }); const existing = await access.database.select().from(reactions).where(and(eq(reactions.messageId, messageId), eq(reactions.userId, access.user.id), eq(reactions.emoji, emoji))).limit(1); if (existing.length) await access.database.delete(reactions).where(and(eq(reactions.messageId, messageId), eq(reactions.userId, access.user.id), eq(reactions.emoji, emoji))); else await access.database.insert(reactions).values({ messageId, userId: access.user.id, emoji }); return NextResponse.json({ active: !existing.length }); }
  if (!access.owner && !hasPermission(access.permissions, SpacePermission.SEND_MESSAGES)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права отправлять сообщения." }, { status: 403 });
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 4000) : ""; const attachments = Array.isArray(body?.attachments) ? body.attachments.filter((item: unknown) => { if (!item || typeof item !== "object") return false; const attachment = item as Record<string, unknown>; return attachment.type === "voice" && typeof attachment.url === "string" && attachment.url.startsWith("data:audio/") && attachment.url.length <= 3_000_000 && typeof attachment.duration === "number" && attachment.duration > 0 && attachment.duration <= 65; }).slice(0, 1) : [];
  if (attachments.length && !access.owner && !hasPermission(access.permissions, SpacePermission.AttachFiles)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права прикреплять файлы." }, { status: 403 });
  if (access.channel.kind === "announcement" && access.channel.ownerId !== access.user.id) return NextResponse.json({ code: "READ_ONLY", message: "Публиковать объявления может только владелец." }, { status: 403 });
  if (!content && !attachments.length) return NextResponse.json({ code: "EMPTY_MESSAGE", message: "Сообщение пустое." }, { status: 400 });
  const replyToId = typeof body?.replyToId === "string" ? body.replyToId : null;
  const threadRootId = typeof body?.threadRootId === "string" ? body.threadRootId : null;
  for (const messageId of [replyToId, threadRootId].filter((id): id is string => Boolean(id))) {
    const [related] = await access.database.select({ id: messages.id }).from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId), isNull(messages.deletedAt))).limit(1);
    if (!related) return NextResponse.json({ code: "INVALID_MESSAGE_REFERENCE", message: "Исходное сообщение недоступно в этом канале." }, { status: 400 });
  }
  if (access.channel.ownerId !== access.user.id) {
    const [timeout] = await access.database.select({ expiresAt: moderationCases.expiresAt }).from(moderationCases).where(and(eq(moderationCases.spaceId, access.channel.spaceId), eq(moderationCases.targetUserId, access.user.id), eq(moderationCases.action, "timeout"), gt(moderationCases.expiresAt, new Date()))).orderBy(desc(moderationCases.createdAt)).limit(1);
    if (timeout?.expiresAt) return NextResponse.json({ code: "TIMED_OUT", message: `Отправка сообщений ограничена до ${timeout.expiresAt.toLocaleString("ru-RU")}.` }, { status: 403 });
  }
  const assessment = assessMessageSafety(content);
  const id = randomUUID();
  await access.database.transaction(async (tx) => {
    await tx.insert(messages).values({ id, channelId, authorId: access.user.id, content, attachments, replyToId, threadRootId, deletedAt: assessment.autoHide ? new Date() : null });
    if (assessment.flagged) await tx.insert(moderationFlags).values({ id: randomUUID(), spaceId: access.channel.spaceId, channelId, messageId: id, authorId: access.user.id, category: assessment.category!, severity: assessment.severity, confidence: assessment.confidence, summary: assessment.summary, evidence: assessment.signals, autoHidden: assessment.autoHide });
  });
  if (assessment.autoHide) return NextResponse.json({ code: "MODERATION_HELD", message: "Сообщение временно скрыто автоматической защитой и отправлено на проверку модератору." }, { status: 422 });
  const createdAt = new Date().toISOString();
  after(() => dispatchDeveloperEvent(access.channel.spaceId, "message.created", { message: { id, channelId, spaceId: access.channel.spaceId, authorId: access.user.id, username: access.user.username, displayName: access.user.displayName, content, attachments, replyToId, threadRootId, createdAt } }).catch(() => undefined));
  return NextResponse.json({ message: { id, channelId, authorId: access.user.id, displayName: access.user.displayName, username: access.user.username, avatarUrl: access.user.avatarUrl, content, attachments, replyToId, threadRootId, reactions: [], createdAt }, moderation: assessment.flagged ? { status: "pending", severity: assessment.severity } : null }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return untrusted();
  const { channelId } = await params; const access = await accessChannel(channelId); if ("error" in access) return access.error; const body = await request.json().catch(() => null);
  if (body?.action === "notifications") { const mode = ["all", "mentions", "none"].includes(body.mode) ? body.mode : "mentions"; await access.database.insert(channelNotificationSettings).values({ userId: access.user.id, channelId, mode }).onConflictDoUpdate({ target: [channelNotificationSettings.userId, channelNotificationSettings.channelId], set: { mode, updatedAt: new Date() } }); return NextResponse.json({ mode }); }
  const messageId = String(body?.messageId ?? ""); const [message] = await access.database.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1); if (!message) return NextResponse.json({ message: "Сообщение не найдено." }, { status: 404 });
  if (body?.action === "pin") { if (!access.owner && !hasPermission(access.permissions, SpacePermission.MANAGE_MESSAGES)) return NextResponse.json({ message: "Недостаточно прав для закрепления сообщений." }, { status: 403 }); await access.database.update(messages).set({ pinnedAt: message.pinnedAt ? null : new Date(), pinnedById: message.pinnedAt ? null : access.user.id }).where(eq(messages.id, messageId)); return NextResponse.json({ pinned: !message.pinnedAt }); }
  if (message.authorId !== access.user.id) return NextResponse.json({ message: "Можно редактировать только свои сообщения." }, { status: 403 }); const content = String(body?.content ?? "").trim().slice(0, 4000); if (!content) return NextResponse.json({ message: "Сообщение пустое." }, { status: 400 });
  const assessment = assessMessageSafety(content);
  await access.database.transaction(async (tx) => {
    await tx.update(messages).set({ content, editedAt: new Date(), deletedAt: assessment.autoHide ? new Date() : message.deletedAt }).where(eq(messages.id, messageId));
    if (assessment.flagged) await tx.insert(moderationFlags).values({ id: randomUUID(), spaceId: access.channel.spaceId, channelId, messageId, authorId: access.user.id, category: assessment.category!, severity: assessment.severity, confidence: assessment.confidence, summary: assessment.summary, evidence: assessment.signals, autoHidden: assessment.autoHide }).onConflictDoUpdate({ target: moderationFlags.messageId, set: { category: assessment.category!, severity: assessment.severity, confidence: assessment.confidence, summary: assessment.summary, evidence: assessment.signals, status: "pending", autoHidden: assessment.autoHide, reviewedById: null, reviewedAt: null } });
  });
  if (assessment.autoHide) return NextResponse.json({ code: "MODERATION_HELD", message: "Изменённое сообщение скрыто до проверки модератором." }, { status: 422 });
  return NextResponse.json({ content, moderation: assessment.flagged ? { status: "pending", severity: assessment.severity } : null });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) { if (!isTrustedMutationRequest(request)) return untrusted(); const { channelId } = await params; const access = await accessChannel(channelId); if ("error" in access) return access.error; const messageId = new URL(request.url).searchParams.get("messageId") ?? ""; const [message] = await access.database.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1); if (!message) return NextResponse.json({ message: "Сообщение не найдено." }, { status: 404 }); if (message.authorId !== access.user.id && !access.owner && !hasPermission(access.permissions, SpacePermission.MANAGE_MESSAGES)) return NextResponse.json({ message: "Недостаточно прав." }, { status: 403 }); await access.database.update(messages).set({ deletedAt: new Date(), content: "" }).where(eq(messages.id, messageId)); return NextResponse.json({ ok: true }); }
