import { describe, expect, it } from "vitest";
import { isMutationOriginExempt, isProtectedRoute, loginPathFor, MUTATION_ORIGIN_EXEMPT_PATHS, PROTECTED_ROUTE_PREFIXES } from "../lib/route-access";

describe("protected route boundaries", () => {
  it("protects setup and oauth routes", () => {
    expect(PROTECTED_ROUTE_PREFIXES).toContain("/setup");
    expect(PROTECTED_ROUTE_PREFIXES).toContain("/oauth");
    expect(isProtectedRoute("/setup")).toBe(true);
    expect(isProtectedRoute("/setup/release-0015")).toBe(true);
    expect(isProtectedRoute("/oauth/authorize")).toBe(true);
    expect(isProtectedRoute("/oauth/install")).toBe(true);
  });

  it("exempts only the signed LiveKit webhook from browser origin checks", () => {
    expect(MUTATION_ORIGIN_EXEMPT_PATHS).toEqual(["/api/livekit/webhook"]);
    expect(isMutationOriginExempt("/api/livekit/webhook")).toBe(true);
    expect(isMutationOriginExempt("/api/livekit/webhook/other")).toBe(false);
    expect(isMutationOriginExempt("/api/v1/channels/voice/voice")).toBe(false);
  });

  it("does not overmatch similarly named public paths", () => {
    expect(isProtectedRoute("/setups")).toBe(false);
    expect(isProtectedRoute("/oauth2")).toBe(false);
  });

  it("preserves destination path and query in the login redirect", () => {
    expect(loginPathFor("/setup/release-0015", "?mode=check")).toBe(
      "/login?next=%2Fsetup%2Frelease-0015%3Fmode%3Dcheck",
    );
    expect(loginPathFor("/oauth/authorize", "?client_id=abc&scope=identify")).toBe(
      "/login?next=%2Foauth%2Fauthorize%3Fclient_id%3Dabc%26scope%3Didentify",
    );
  });
});
