import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerOauthAuthorizationCodes, developerOauthClients } from "@/db/developer-schema";
import { developerApps } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ValidatedRequest = {
  appId: string;
  appName: string;
  redirectUri: string;
  scopes: string[];
  state: string | null;
  codeChallenge: string | null;
};

function parseScopes(raw: unknown, allowed: string[]) {
  const values = typeof raw === "string" ? raw.split(/\s+/).filter(Boolean) : Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
  const requested = [...new Set(values.length ? values : ["identify"])];
  if (requested.some((scope) => !allowed.includes(scope))) return null;
  return requested;
}

async function validateAuthorization(input: Record<string, unknown>): Promise<{ error: NextResponse } | { value: ValidatedRequest }> {
  const clientId = typeof input.clientId === "string" ? input.clientId.trim() : "";
  const redirectUri = typeof input.redirectUri === "string" ? input.redirectUri.trim() : "";
  const responseType = typeof input.responseType === "string" ? input.responseType : "code";
  const state = typeof input.state === "string" ? input.state.slice(0, 300) : null;
  const codeChallenge = typeof input.codeChallenge === "string" ? input.codeChallenge.trim() : null;
  const codeChallengeMethod = typeof input.codeChallengeMethod === "string" ? input.codeChallengeMethod : null;

  if (!clientId || !redirectUri || responseType !== "code") return { error: NextResponse.json({ code: "INVALID_REQUEST", message: "Некорректный OAuth-запрос." }, { status: 400 }) };
  if (codeChallenge && (codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge))) {
    return { error: NextResponse.json({ code: "INVALID_PKCE", message: "Поддерживается только PKCE S256." }, { status: 400 }) };
  }

  const database = getDatabase();
  const [client] = await database.select({
    appId: developerOauthClients.appId,
    clientId: developerOauthClients.clientId,
    redirectUris: developerOauthClients.redirectUris,
    scopes: developerOauthClients.scopes,
    appName: developerApps.name,
  }).from(developerOauthClients)
    .innerJoin(developerApps, eq(developerApps.id, developerOauthClients.appId))
    .where(eq(developerOauthClients.clientId, clientId)).limit(1);

  if (!client) return { error: NextResponse.json({ code: "INVALID_CLIENT", message: "OAuth client не найден." }, { status: 404 }) };
  if (!client.redirectUris.includes(redirectUri)) return { error: NextResponse.json({ code: "INVALID_REDIRECT_URI", message: "Redirect URI не зарегистрирован." }, { status: 400 }) };
  const scopes = parseScopes(input.scope, client.scopes);
  if (!scopes) return { error: NextResponse.json({ code: "INVALID_SCOPE", message: "Запрошен недоступный OAuth scope." }, { status: 400 }) };

  return { value: { appId: client.appId, appName: client.appName, redirectUri, scopes, state, codeChallenge } };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const validated = await validateAuthorization({
    clientId: query.get("client_id"),
    redirectUri: query.get("redirect_uri"),
    responseType: query.get("response_type"),
    scope: query.get("scope"),
    state: query.get("state"),
    codeChallenge: query.get("code_challenge"),
    codeChallengeMethod: query.get("code_challenge_method"),
  });
  if ("error" in validated) return validated.error;
  return NextResponse.json({
    authorization: {
      appName: validated.value.appName,
      redirectUri: validated.value.redirectUri,
      scopes: validated.value.scopes,
      state: validated.value.state,
    },
    user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ code: "INVALID_REQUEST", message: "Некорректный OAuth-запрос." }, { status: 400 });
  const validated = await validateAuthorization(body);
  if ("error" in validated) return validated.error;

  const rawCode = `fz_code_${randomBytes(32).toString("base64url")}`;
  const codeHash = createHash("sha256").update(rawCode).digest("hex");
  await getDatabase().insert(developerOauthAuthorizationCodes).values({
    id: randomUUID(),
    codeHash,
    appId: validated.value.appId,
    userId: user.id,
    redirectUri: validated.value.redirectUri,
    scopes: validated.value.scopes,
    codeChallenge: validated.value.codeChallenge,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  const redirect = new URL(validated.value.redirectUri);
  redirect.searchParams.set("code", rawCode);
  if (validated.value.state) redirect.searchParams.set("state", validated.value.state);
  return NextResponse.json({ redirectUrl: redirect.toString() });
}
