import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestOptions, IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";
const state = vi.hoisted(() => ({
  addresses: [{ address: "8.8.8.8", family: 4 }], status: 204, connected: "", requests: 0, lookups: 0,
}));
vi.mock("node:dns/promises", () => ({ lookup: async () => { state.lookups++; return state.addresses; } }));
vi.mock("node:https", () => ({
  request: (_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    state.requests++;
    options.lookup!("hooks.test", { family: 4 }, (_error, address) => { state.connected = String(address); });
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => queueMicrotask(() => callback({ statusCode: state.status, destroy: () => {} } as IncomingMessage));
    return request;
  },
}));
import { postPublicWebhook } from "../lib/webhook-http";
import { isPrivateWebhookIp } from "../lib/developer-validation";
beforeEach(() => {
  state.addresses = [{ address: "8.8.8.8", family: 4 }];
  state.status = 204; state.connected = ""; state.requests = 0; state.lookups = 0;
});
describe("webhook network boundary", () => {
  it("pins the checked DNS address without performing another lookup", async () => {
    expect(await postPublicWebhook("https://hooks.test/event", "{}", {})).toEqual({ ok: true, status: 204 });
    expect(state.connected).toBe("8.8.8.8");
    expect(state.lookups).toBe(1);
  });
  it("does not follow an endpoint redirect", async () => {
    state.status = 307;
    expect(await postPublicWebhook("https://hooks.test/event", "{}", {})).toEqual({ ok: false, status: 307 });
    expect(state.requests).toBe(1);
  });
  it("rejects a hostname with any private resolved address before connecting", async () => {
    state.addresses.push({ address: "127.0.0.1", family: 4 });
    await expect(postPublicWebhook("https://hooks.test/event", "{}", {})).rejects.toThrow("private");
    expect(state.requests).toBe(0);
  });
  it.each(["192.0.2.1", "203.0.113.2", "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1", "ff02::1"])("rejects reserved/transition address %s", address => {
    expect(isPrivateWebhookIp(address)).toBe(true);
  });
});
