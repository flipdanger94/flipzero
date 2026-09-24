import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth", () => ({ getCurrentUser: async () => { throw new Error("Authentication must not run for a cross-site mutation"); } }));

import { POST as sendDirectMessage } from "../app/api/messages/route";
import { POST as joinVoice } from "../app/api/v1/channels/[channelId]/voice/route";
import { POST as uploadMedia } from "../app/api/v1/media/route";
import { isTrustedMutationRequest } from "../lib/security-controls";

describe("mutation origin boundaries", () => {
  it("accepts browser-confirmed same-origin mutations behind a proxy", () => {
    const request = new Request("http://127.0.0.1:3000/api/v1/auth/register", {
      method: "POST",
      headers: {
        origin: "https://example-codespace-3000.app.github.dev",
        "sec-fetch-site": "same-origin",
        host: "127.0.0.1:3000",
      },
    });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });
  it("accepts a Codespaces HTTPS origin when the proxy rewrites the internal host", () => {
    const previous = process.env.CODESPACES;
    process.env.CODESPACES = "true";
    try {
      const request = new Request("http://127.0.0.1:3000/api/v1/auth/register", {
        method: "POST",
        headers: {
          origin: "https://didactic-waffle-example-3000.app.github.dev",
          host: "127.0.0.1:3000",
        },
      });
      expect(isTrustedMutationRequest(request)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CODESPACES;
      else process.env.CODESPACES = previous;
    }
  });

  it("rejects cross-site direct messages, voice joins and media uploads before authentication", async () => {
    const request = (path: string) => new Request(`https://flipzero.app${path}`, {
      method: "POST", headers: { origin: "https://untrusted.example", "sec-fetch-site": "cross-site" },
    });
    const context = { params: Promise.resolve({ channelId: "voice-1" }) };
    const responses = await Promise.all([
      sendDirectMessage(request("/api/messages")),
      joinVoice(request("/api/v1/channels/voice-1/voice"), context),
      uploadMedia(request("/api/v1/media")),
    ]);
    expect(responses.map((response) => response?.status)).toEqual([403, 403, 403]);
  });
});


describe("Codespaces auth development boundary", () => {
  it("documents that auth origin enforcement is production-only", async () => {
    const [loginSource, registerSource] = await Promise.all([
      import("node:fs/promises").then(({ readFile }) => readFile("app/api/v1/auth/login/route.ts", "utf8")),
      import("node:fs/promises").then(({ readFile }) => readFile("app/api/v1/auth/register/route.ts", "utf8")),
    ]);
    expect(loginSource).toContain('process.env.NODE_ENV === "production" && !isTrustedMutationRequest(request)');
    expect(registerSource).toContain('process.env.NODE_ENV === "production" && !isTrustedMutationRequest(request)');
  });
});


describe("Codespaces auth explicit bypass", () => {
  it("Codespaces bypass is explicit even if NODE_ENV is production", async () => {
    const { readFile } = await import("node:fs/promises");
    const [loginSource, registerSource] = await Promise.all([
      readFile("app/api/v1/auth/login/route.ts", "utf8"),
      readFile("app/api/v1/auth/register/route.ts", "utf8"),
    ]);
    const guard = 'process.env.CODESPACES !== "true" && process.env.NODE_ENV === "production" && !isTrustedMutationRequest(request)';
    expect(loginSource).toContain(guard);
    expect(registerSource).toContain(guard);
  });
});


describe("proxy mutation origin handling", () => {
  it("proxy accepts browser-confirmed same-origin mutations behind a rewritten host", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("proxy.ts", "utf8");
    expect(source).toContain('let trusted = fetchSite === "same-origin"');
    expect(source).toContain('fetchSite !== "cross-site"');
    expect(source).toContain('request.headers.get("x-forwarded-host")');
  });
});
