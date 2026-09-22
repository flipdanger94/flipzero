import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerAppInstallations } from "@/db/developer-schema";
import { developerApps, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireOwnedApp(appId: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) } as const;
  if (!appId) return { error: NextResponse.json({ code: "INVALID_INPUT", message: "Приложение не выбрано." }, { status: 400 }) } as const;

  const database = getDatabase();
  const [app] = await database.select({ id: developerApps.id }).from(developerApps)
    .where(and(eq(developerApps.id, appId), eq(developerApps.ownerId, user.id))).limit(1);
  if (!app) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Приложение не найдено." }, { status: 404 }) } as const;
  return { user, database, app } as const;
}

export async function GET(request: Request) {
  const appId = new URL(request.url).searchParams.get("appId");
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;

  const [ownedSpaces, installed] = await Promise.all([
    access.database.select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      iconUrl: spaces.iconUrl,
      accentColor: spaces.accentColor,
    }).from(spaces).where(eq(spaces.ownerId, access.user.id)).orderBy(asc(spaces.name)),
    access.database.select({
      appId: developerAppInstallations.appId,
      spaceId: developerAppInstallations.spaceId,
      permissions: developerAppInstallations.permissions,
      createdAt: developerAppInstallations.createdAt,
    }).from(developerAppInstallations).where(eq(developerAppInstallations.appId, access.app.id)),
  ]);

  const bySpace = new Map(installed.map((item) => [item.spaceId, item]));
  return NextResponse.json({
    spaces: ownedSpaces.map((space) => ({
      ...space,
      installation: bySpace.get(space.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const spaceId = typeof body?.spaceId === "string" ? body.spaceId : null;
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;
  if (!spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Сервер не выбран." }, { status: 400 });

  const [space] = await access.database.select({ id: spaces.id }).from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, access.user.id))).limit(1);
  if (!space) return NextResponse.json({ code: "FORBIDDEN", message: "Установить приложение можно только в сервер, которым вы владеете." }, { status: 403 });

  const [installation] = await access.database.insert(developerAppInstallations).values({
    appId: access.app.id,
    spaceId: space.id,
    installedById: access.user.id,
    permissions: ["events:read"],
  }).onConflictDoUpdate({
    target: [developerAppInstallations.appId, developerAppInstallations.spaceId],
    set: { installedById: access.user.id, permissions: ["events:read"], updatedAt: new Date() },
  }).returning();

  return NextResponse.json({ installation }, { status: 201 });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireOwnedApp(params.get("appId"));
  if ("error" in access) return access.error;
  const spaceId = params.get("spaceId");
  if (!spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Сервер не выбран." }, { status: 400 });

  const [space] = await access.database.select({ id: spaces.id }).from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, access.user.id))).limit(1);
  if (!space) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для удаления установки." }, { status: 403 });

  await access.database.delete(developerAppInstallations).where(and(
    eq(developerAppInstallations.appId, access.app.id),
    eq(developerAppInstallations.spaceId, space.id),
  ));
  return NextResponse.json({ ok: true });
}
