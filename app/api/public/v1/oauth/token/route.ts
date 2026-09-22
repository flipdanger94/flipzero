import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerOauthAccessTokens, developerOauthAuthorizationCodes, developerOauthClients } from "@/db/developer-schema";

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }
  return await request.json().catch(() => null) as Record<string, unknown> | null;
}

function secureEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "invalid_request", error_description: "Некорректный запрос." }, { status: 400 });

  const grantType = typeof body.grant_type === "string" ? body.grant_type : "";
  const code = typeof body.code === "string" ? body.code : "";
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const clientSecret = typeof body.client_secret === "string" ? body.client_secret : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier : "";

  if (grantType !== "authorization_code" || !code || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "invalid_request", error_description: "grant_type, code, client_id, client_secret и redirect_uri обязательны." }, { status: 400 });
  }

  const database = getDatabase();
  const [client] = await database.select({
    appId: developerOauthClients.appId,
    clientSecretHash: developerOauthClients.clientSecretHash,
  }).from(developerOauthClients).where(eq(developerOauthClients.clientId, clientId)).limit(1);

  if (!client) return NextResponse.json({ error: "invalid_client", error_description: "OAuth client не найден." }, { status: 401 });
  const providedSecretHash = createHash("sha256").update(clientSecret).digest("hex");
  if (!secureEqualHex(client.clientSecretHash, providedSecretHash)) return NextResponse.json({ error: "invalid_client", error_description: "Неверный client secret." }, { status: 401 });

  const codeHash = createHash("sha256").update(code).digest("hex");
  const [authorization] = await database.select({
    id: developerOauthAuthorizationCodes.id,
    appId: developerOauthAuthorizationCodes.appId,
    userId: developerOauthAuthorizationCodes.userId,
    redirectUri: developerOauthAuthorizationCodes.redirectUri,
    scopes: developerOauthAuthorizationCodes.scopes,
    codeChallenge: developerOauthAuthorizationCodes.codeChallenge,
  }).from(developerOauthAuthorizationCodes).where(and(
    eq(developerOauthAuthorizationCodes.codeHash, codeHash),
    eq(developerOauthAuthorizationCodes.appId, client.appId),
    isNull(developerOauthAuthorizationCodes.consumedAt),
    gt(developerOauthAuthorizationCodes.expiresAt, new Date()),
  )).limit(1);

  if (!authorization || authorization.redirectUri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant", error_description: "Authorization code недействителен или истёк." }, { status: 400 });
  }

  if (authorization.codeChallenge) {
    if (!codeVerifier) return NextResponse.json({ error: "invalid_grant", error_description: "Для этого кода требуется PKCE code_verifier." }, { status: 400 });
    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (challenge !== authorization.codeChallenge) return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed." }, { status: 400 });
  }

  const rawToken = `fz_oauth_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const consumed = await database.transaction(async (tx) => {
    const [claimed] = await tx.update(developerOauthAuthorizationCodes).set({ consumedAt: new Date() }).where(and(
      eq(developerOauthAuthorizationCodes.id, authorization.id),
      isNull(developerOauthAuthorizationCodes.consumedAt),
      gt(developerOauthAuthorizationCodes.expiresAt, new Date()),
    )).returning({ id: developerOauthAuthorizationCodes.id });
    if (!claimed) return false;

    await tx.insert(developerOauthAccessTokens).values({
      id: randomUUID(),
      appId: authorization.appId,
      userId: authorization.userId,
      tokenHash,
      prefix: `${rawToken.slice(0, 18)}…`,
      scopes: authorization.scopes,
      expiresAt,
    });
    return true;
  });

  if (!consumed) return NextResponse.json({ error: "invalid_grant", error_description: "Authorization code уже использован." }, { status: 400 });

  return NextResponse.json({
    access_token: rawToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: authorization.scopes.join(" "),
  }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
}
