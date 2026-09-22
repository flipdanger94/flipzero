import { describe, expect, it } from "vitest";
import { normalizeApiTokenScopes, normalizeOAuthScopes, normalizeWebhookEvents, validateRedirectUris, validateWebhookUrl } from "../lib/developer-validation";

describe("developer platform validation", () => {
  it("filters API scopes to supported values", () => {
    expect(normalizeApiTokenScopes(["profile:read", "admin:write", "spaces:read", "profile:read"])).toEqual(["profile:read", "spaces:read"]);
  });

  it("keeps OAuth scopes safe and deduplicated", () => {
    expect(normalizeOAuthScopes(["identify", "spaces:read", "unknown", "identify"])).toEqual(["identify", "spaces:read"]);
  });

  it("accepts HTTPS redirect URIs and localhost HTTP", () => {
    const result = validateRedirectUris(["https://example.com/oauth/callback", "http://localhost:3000/callback"]);
    expect(result.ok).toBe(true);
  });

  it("rejects insecure remote redirect URIs", () => {
    const result = validateRedirectUris(["http://example.com/callback"]);
    expect(result.ok).toBe(false);
  });

  it("requires HTTPS webhooks", () => {
    expect(validateWebhookUrl("https://hooks.example.com/flipzero").ok).toBe(true);
    expect(validateWebhookUrl("http://hooks.example.com/flipzero").ok).toBe(false);
  });

  it("filters webhook event names", () => {
    expect(normalizeWebhookEvents(["message.created", "root.shell", "space.updated"])).toEqual(["message.created", "space.updated"]);
  });
});
