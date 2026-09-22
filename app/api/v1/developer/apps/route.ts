import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { apiTokens, developerApps } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeApiTokenScopes } from "@/lib/developer-validation";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  return { user, database: getDatabase() };
}

export async function GET() {
  const access = await requireUser();
  if ("error" in access) return access.error;
  const apps = await access.database.select().from(developerApps).where(eq(developerApps.ownerId, access.user.id)).orderBy(desc(developerApps.createdAt));
  const tokens = apps.length ? await access.database.select({ id: apiTokens.id, appId: apiTokens.appId, name: apiTokens.name, prefix: apiTokens.prefix, scopes: apiTokens.scopes, lastUsedAt: apiTokens.lastUsedAt, expiresAt: apiTokens.expiresAt, revokedAt: apiTokens.revokedAt, createdAt: apiTokens.createdAt }).from(apiTokens).innerJoin(developerApps, eq(developerApps.id, apiTokens.appId)).where(eq(developerApps.ownerId, access.user.id)).orderBy(desc(apiTokens.createdAt)) : [];
  return NextResponse.json({ apps: apps.map((app) => ({ ...app, tokens: tokens.filter((token) => token.appId === app.id) })) });
}

export async function POST(request: Request) {
  const access = await requireUser();
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (body?.action === "create_token") {
    if (typeof body.appId !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Приложение не выбрано." }, { status: 400 });
    const [app] = await access.database.select({ id: developerApps.id }).from(developerApps).where(and(eq(developerApps.id, body.appId), eq(developerApps.ownerId, access.user.id))).limit(1);
    if (!app) return NextResponse.json({ code: "NOT_FOUND", message: "Приложение не найдено." }, { status: 404 });
    const [{ count }] = await access.database.select({ count: sql<number>`count(*)::int` }).from(apiTokens).where(and(eq(apiTokens.appId, app.id), isNull(apiTokens.revokedAt)));
    if (count >= 5) return NextResponse.json({ code: "TOKEN_LIMIT", message: "Можно иметь не более пяти активных ключей." }, { status: 409 });
    const rawToken = `fz_live_${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const [token] = await access.database.insert(apiTokens).values({ id: randomUUID(), appId: app.id, name: typeof body.name === "string" ? body.name.trim().slice(0, 50) || "Основной ключ" : "Основной ключ", tokenHash, prefix: `${rawToken.slice(0, 16)}…`, scopes: normalizeApiTokenScopes(body.scopes) }).returning({ id: apiTokens.id, appId: apiTokens.appId, name: apiTokens.name, prefix: apiTokens.prefix, scopes: apiTokens.scopes, createdAt: apiTokens.createdAt });
    return NextResponse.json({ token, secret: rawToken }, { status: 201 });
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 240) : "";
  if (name.length < 2) return NextResponse.json({ code: "INVALID_INPUT", message: "Укажите название приложения." }, { status: 400 });
  const [{ count }] = await access.database.select({ count: sql<number>`count(*)::int` }).from(developerApps).where(eq(developerApps.ownerId, access.user.id));
  if (count >= 10) return NextResponse.json({ code: "APP_LIMIT", message: "Можно создать не более десяти приложений." }, { status: 409 });
  const [app] = await access.database.insert(developerApps).values({ id: randomUUID(), ownerId: access.user.id, name, description: description || null }).returning();
  return NextResponse.json({ app: { ...app, tokens: [] } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await requireUser();
  if ("error" in access) return access.error;
  const params = new URL(request.url).searchParams;
  const tokenId = params.get("tokenId");
  const appId = params.get("appId");
  if (tokenId) {
    const [ownedToken] = await access.database.select({ id: apiTokens.id }).from(apiTokens).innerJoin(developerApps, eq(developerApps.id, apiTokens.appId)).where(and(eq(apiTokens.id, tokenId), eq(developerApps.ownerId, access.user.id))).limit(1);
    if (!ownedToken) return NextResponse.json({ code: "NOT_FOUND", message: "API-ключ не найден." }, { status: 404 });
    await access.database.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, ownedToken.id));
    return NextResponse.json({ ok: true });
  }
  if (appId) {
    await access.database.delete(developerApps).where(and(eq(developerApps.id, appId), eq(developerApps.ownerId, access.user.id)));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ code: "INVALID_INPUT", message: "Не выбран ключ или приложение." }, { status: 400 });
}
