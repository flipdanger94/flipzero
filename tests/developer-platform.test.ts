import { describe, expect, it } from "vitest";
import { isPrivateWebhookIp, normalizeApiTokenScopes, normalizeOAuthScopes, normalizeWebhookEvents, validateRedirectUris, validateWebhookUrl } from "../lib/developer-validation";
import { createPkceS256Challenge } from "../lib/oauth-pkce";

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

  it("rejects local webhook targets", () => {
    expect(validateWebhookUrl("https://localhost/hooks").ok).toBe(false);
    expect(validateWebhookUrl("https://127.0.0.1/hooks").ok).toBe(false);
    expect(validateWebhookUrl("https://service.internal/hooks").ok).toBe(false);
  });

  it("matches the RFC 7636 PKCE S256 vector", () => {
    expect(createPkceS256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("classifies private and reserved webhook IP ranges", () => {
    expect(isPrivateWebhookIp("127.0.0.1")).toBe(true);
    expect(isPrivateWebhookIp("10.20.30.40")).toBe(true);
    expect(isPrivateWebhookIp("172.16.1.1")).toBe(true);
    expect(isPrivateWebhookIp("192.168.1.1")).toBe(true);
    expect(isPrivateWebhookIp("::1")).toBe(true);
    expect(isPrivateWebhookIp("fd00::1")).toBe(true);
    expect(isPrivateWebhookIp("8.8.8.8")).toBe(false);
    expect(isPrivateWebhookIp("2606:4700:4700::1111")).toBe(false);
  });

  it("filters webhook event names", () => {
    expect(normalizeWebhookEvents(["message.created", "root.shell", "space.updated"])).toEqual(["message.created", "space.updated"]);
  });
});
