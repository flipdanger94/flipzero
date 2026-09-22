import { createHash } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { developerOauthAccessTokens } from "@/db/developer-schema";
import { apiTokens, developerApps, users } from "@/db/schema";

export async function authenticateApiRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if ((!token.startsWith("fz_live_") && !token.startsWith("fz_oauth_")) || token.length < 30) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const database = getDatabase();

  if (token.startsWith("fz_oauth_")) {
    const [credential] = await database.select({
      tokenId: developerOauthAccessTokens.id,
      scopes: developerOauthAccessTokens.scopes,
      appId: developerApps.id,
      appName: developerApps.name,
      ownerId: users.id,
      username: users.username,
      displayName: users.displayName,
    }).from(developerOauthAccessTokens)
      .innerJoin(developerApps, eq(developerApps.id, developerOauthAccessTokens.appId))
      .innerJoin(users, eq(users.id, developerOauthAccessTokens.userId))
      .where(and(
        eq(developerOauthAccessTokens.tokenHash, tokenHash),
        isNull(developerOauthAccessTokens.revokedAt),
        gt(developerOauthAccessTokens.expiresAt, new Date()),
      )).limit(1);

    if (!credential) return null;
    await database.update(developerOauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(developerOauthAccessTokens.id, credential.tokenId));
    return { ...credential, tokenType: "oauth" as const, scopes: Array.isArray(credential.scopes) ? credential.scopes as string[] : [] };
  }

  const [credential] = await database.select({
    tokenId: apiTokens.id,
    scopes: apiTokens.scopes,
    appId: developerApps.id,
    appName: developerApps.name,
    ownerId: users.id,
    username: users.username,
    displayName: users.displayName,
  }).from(apiTokens)
    .innerJoin(developerApps, eq(developerApps.id, apiTokens.appId))
    .innerJoin(users, eq(users.id, developerApps.ownerId))
    .where(and(
      eq(apiTokens.tokenHash, tokenHash),
      isNull(apiTokens.revokedAt),
      or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date())),
    )).limit(1);

  if (!credential) return null;
  await database.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, credential.tokenId));
  return { ...credential, tokenType: "api" as const, scopes: Array.isArray(credential.scopes) ? credential.scopes as string[] : [] };
}
