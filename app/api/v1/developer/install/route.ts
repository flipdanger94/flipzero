import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerAppInstallations } from "@/db/developer-schema";
import { developerApps, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function context(appId: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) } as const;
  if (!appId) return { error: NextResponse.json({ code: "INVALID_INPUT", message: "Приложение не выбрано." }, { status: 400 }) } as const;

  const database = getDatabase();
  const [app] = await database.select({
    id: developerApps.id,
    name: developerApps.name,
    description: developerApps.description,
    ownerId: developerApps.ownerId,
  }).from(developerApps).where(eq(developerApps.id, appId)).limit(1);
  if (!app) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Приложение не найдено." }, { status: 404 }) } as const;
  return { user, database, app } as const;
}

export async function GET(request: Request) {
  const access = await context(new URL(request.url).searchParams.get("appId"));
  if ("error" in access) return access.error;

  const ownedSpaces = await access.database.select({
    id: spaces.id,
    name: spaces.name,
    slug: spaces.slug,
    accentColor: spaces.accentColor,
  }).from(spaces).where(eq(spaces.ownerId, access.user.id)).orderBy(asc(spaces.name));

  const installations = ownedSpaces.length
    ? await access.database.select({ spaceId: developerAppInstallations.spaceId })
      .from(developerAppInstallations)
      .where(eq(developerAppInstallations.appId, access.app.id))
    : [];
  const installed = new Set(installations.map((item) => item.spaceId));

  return NextResponse.json({
    app: { id: access.app.id, name: access.app.name, description: access.app.description },
    spaces: ownedSpaces.map((space) => ({ ...space, installed: installed.has(space.id) })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const spaceId = typeof body?.spaceId === "string" ? body.spaceId : null;
  const access = await context(appId);
  if ("error" in access) return access.error;
  if (!spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Сервер не выбран." }, { status: 400 });

  const [space] = await access.database.select({ id: spaces.id, name: spaces.name }).from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, access.user.id))).limit(1);
  if (!space) return NextResponse.json({ code: "FORBIDDEN", message: "Установить приложение можно только в сервер, которым вы владеете." }, { status: 403 });

  await access.database.insert(developerAppInstallations).values({
    appId: access.app.id,
    spaceId: space.id,
    installedById: access.user.id,
    permissions: ["events:read"],
  }).onConflictDoUpdate({
    target: [developerAppInstallations.appId, developerAppInstallations.spaceId],
    set: { installedById: access.user.id, permissions: ["events:read"], updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, space: { id: space.id, name: space.name }, app: { id: access.app.id, name: access.app.name } });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await context(params.get("appId"));
  if ("error" in access) return access.error;
  const spaceId = params.get("spaceId");
  if (!spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Сервер не выбран." }, { status: 400 });

  const [space] = await access.database.select({ id: spaces.id }).from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, access.user.id))).limit(1);
  if (!space) return NextResponse.json({ code: "FORBIDDEN", message: "Удалить приложение может владелец сервера." }, { status: 403 });

  await access.database.delete(developerAppInstallations).where(and(
    eq(developerAppInstallations.appId, access.app.id),
    eq(developerAppInstallations.spaceId, space.id),
  ));
  return NextResponse.json({ ok: true });
}
