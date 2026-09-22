import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerOauthClients } from "@/db/developer-schema";
import { developerApps } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeOAuthScopes, validateRedirectUris } from "@/lib/developer-validation";

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

function createSecret() {
  const secret = `fz_oauth_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    hash: createHash("sha256").update(secret).digest("hex"),
    prefix: `${secret.slice(0, 18)}…`,
  };
}

export async function GET(request: Request) {
  const appId = new URL(request.url).searchParams.get("appId");
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;

  const [client] = await access.database.select({
    appId: developerOauthClients.appId,
    clientId: developerOauthClients.clientId,
    secretPrefix: developerOauthClients.secretPrefix,
    redirectUris: developerOauthClients.redirectUris,
    scopes: developerOauthClients.scopes,
    createdAt: developerOauthClients.createdAt,
    updatedAt: developerOauthClients.updatedAt,
  }).from(developerOauthClients).where(eq(developerOauthClients.appId, access.app.id)).limit(1);

  return NextResponse.json({ oauth: client ?? null });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;

  const redirectUris = validateRedirectUris(body?.redirectUris);
  if (!redirectUris.ok) return NextResponse.json({ code: "INVALID_INPUT", message: redirectUris.message }, { status: 400 });
  const scopes = normalizeOAuthScopes(body?.scopes);

  const [existing] = await access.database.select({ appId: developerOauthClients.appId }).from(developerOauthClients)
    .where(eq(developerOauthClients.appId, access.app.id)).limit(1);

  if (existing) {
    const [oauth] = await access.database.update(developerOauthClients).set({ redirectUris: redirectUris.value, scopes, updatedAt: new Date() })
      .where(eq(developerOauthClients.appId, access.app.id)).returning({
        appId: developerOauthClients.appId,
        clientId: developerOauthClients.clientId,
        secretPrefix: developerOauthClients.secretPrefix,
        redirectUris: developerOauthClients.redirectUris,
        scopes: developerOauthClients.scopes,
        updatedAt: developerOauthClients.updatedAt,
      });
    return NextResponse.json({ oauth });
  }

  const clientId = `fz_client_${randomBytes(12).toString("hex")}`;
  const generated = createSecret();
  const [oauth] = await access.database.insert(developerOauthClients).values({
    appId: access.app.id,
    clientId,
    clientSecretHash: generated.hash,
    secretPrefix: generated.prefix,
    redirectUris: redirectUris.value,
    scopes,
  }).returning({
    appId: developerOauthClients.appId,
    clientId: developerOauthClients.clientId,
    secretPrefix: developerOauthClients.secretPrefix,
    redirectUris: developerOauthClients.redirectUris,
    scopes: developerOauthClients.scopes,
    updatedAt: developerOauthClients.updatedAt,
  });

  return NextResponse.json({ oauth, secret: generated.secret }, { status: 201 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;
  if (body?.action !== "regenerate_secret") return NextResponse.json({ code: "INVALID_INPUT", message: "Неизвестное действие." }, { status: 400 });

  const generated = createSecret();
  const [oauth] = await access.database.update(developerOauthClients).set({
    clientSecretHash: generated.hash,
    secretPrefix: generated.prefix,
    updatedAt: new Date(),
  }).where(eq(developerOauthClients.appId, access.app.id)).returning({
    appId: developerOauthClients.appId,
    clientId: developerOauthClients.clientId,
    secretPrefix: developerOauthClients.secretPrefix,
    redirectUris: developerOauthClients.redirectUris,
    scopes: developerOauthClients.scopes,
    updatedAt: developerOauthClients.updatedAt,
  });

  if (!oauth) return NextResponse.json({ code: "NOT_FOUND", message: "OAuth-клиент ещё не настроен." }, { status: 404 });
  return NextResponse.json({ oauth, secret: generated.secret });
}

export async function DELETE(request: Request) {
  const appId = new URL(request.url).searchParams.get("appId");
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;
  await access.database.delete(developerOauthClients).where(eq(developerOauthClients.appId, access.app.id));
  return NextResponse.json({ ok: true });
}
