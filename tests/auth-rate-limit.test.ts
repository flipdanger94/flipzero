import { beforeEach, describe, expect, it, vi } from "vitest";

let attempts = 0;
const storedKeys: string[] = [];
vi.mock("../db/client", () => ({
  getDatabase: () => ({
    transaction: async (run: (tx: unknown) => Promise<boolean>) => run({
      execute: async () => undefined,
      select: () => ({ from: () => ({ where: async () => [{ value: attempts }] }) }),
      insert: () => ({ values: async (entry: { ipHash: string }) => { storedKeys.push(entry.ipHash); attempts++; } }),
    }),
  }),
}));

import { consumeAuthAttempt } from "../lib/auth-rate-limit";

describe("shared auth attempt policy", () => {
  beforeEach(() => { attempts = 0; storedKeys.length = 0; });

  it("blocks the sixth registration request from the same IP", async () => {
    const request = new Request("https://flipzero.app/register", { headers: { "x-forwarded-for": "203.0.113.7" } });
    for (let index = 0; index < 5; index++) expect(await consumeAuthAttempt(request, "register")).toBe(true);
    expect(await consumeAuthAttempt(request, "register")).toBe(false);
    expect(attempts).toBe(5);
    expect(storedKeys.every((key) => key.startsWith("register:") && !key.includes("203.0.113.7"))).toBe(true);
  });

  it("allows twenty login attempts and then blocks further requests", async () => {
    const request = new Request("https://flipzero.app/login", { headers: { "x-forwarded-for": "203.0.113.7" } });
    for (let index = 0; index < 20; index++) expect(await consumeAuthAttempt(request, "login")).toBe(true);
    expect(await consumeAuthAttempt(request, "login")).toBe(false);
    expect(attempts).toBe(20);
    expect(storedKeys.every((key) => key.startsWith("login:"))).toBe(true);
  });
});
