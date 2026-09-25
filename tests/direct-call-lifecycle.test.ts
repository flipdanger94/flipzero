import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("direct call lifecycle", () => {
  it("uses a short-lived persisted ringing session", async () => {
    const [tokenRoute, migration] = await Promise.all([
      readFile("app/api/v1/direct-calls/token/route.ts", "utf8"),
      readFile("drizzle/0032_direct_call_sessions.sql", "utf8"),
    ]);
    expect(tokenRoute).toContain('ttl: "2m"');
    expect(tokenRoute).toContain('status:"ringing"');
    expect(tokenRoute).toContain("Date.now()+40_000");
    expect(migration).toContain("direct_call_sessions");
    expect(migration).toContain("'ringing','accepted','declined','cancelled','missed','ended'");
  });

  it("provides fast incoming polling and explicit accept/decline/cancel/end states", async () => {
    const source = await readFile("app/api/v1/direct-calls/incoming/route.ts", "utf8");
    expect(source).toContain('action==="cancel"');
    expect(source).toContain('action==="decline"');
    expect(source).toContain('action==="end"');
    expect(source).toContain('status:"missed"');
    expect(source).toContain('status:"accepted"');
  });

  it("keeps the app-level incoming poll active only on visible tabs", async () => {
    const source = await readFile("components/incoming-direct-call.tsx", "utf8");
    expect(source).toContain('document.visibilityState!=="visible"');
    expect(source).toContain("2000");
    expect(source).toContain("visibilitychange");
  });
});
