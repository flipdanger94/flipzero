import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canJoinVoiceChannel, normalizeVoiceUserLimit } from "./voice-channel-limit";

describe("normalizeVoiceUserLimit", () => {
  it("uses null as unlimited", () => {
    expect(normalizeVoiceUserLimit(null)).toBeNull();
    expect(normalizeVoiceUserLimit("")).toBeNull();
  });
  it("accepts boundary values", () => {
    expect(normalizeVoiceUserLimit(1)).toBe(1);
    expect(normalizeVoiceUserLimit(99)).toBe(99);
  });
  it.each([0, 100, -1, 1.5, "1.5", "abc"])("rejects invalid limit %s", (value) => {
    expect(() => normalizeVoiceUserLimit(value)).toThrow("USER_LIMIT_OUT_OF_RANGE");
  });
});

describe("canJoinVoiceChannel", () => {
  it("blocks a new user when full", () => {
    expect(canJoinVoiceChannel({ userLimit: 2, participantCount: 2, alreadyConnected: false, canManage: false })).toBe(false);
  });
  it("allows managers and existing participants past the limit", () => {
    expect(canJoinVoiceChannel({ userLimit: 1, participantCount: 2, alreadyConnected: false, canManage: true })).toBe(true);
    expect(canJoinVoiceChannel({ userLimit: 1, participantCount: 2, alreadyConnected: true, canManage: false })).toBe(true);
  });
  it("does not kick anyone when a limit is lowered below occupancy", () => {
    expect(canJoinVoiceChannel({ userLimit: 1, participantCount: 3, alreadyConnected: true, canManage: false })).toBe(true);
    expect(canJoinVoiceChannel({ userLimit: 1, participantCount: 3, alreadyConnected: false, canManage: false })).toBe(false);
  });
});


describe("join race protection", () => {
  it("keeps the PostgreSQL channel lock in the production join route", () => {
    const source = readFileSync(new URL("../app/api/v1/channels/[channelId]/voice/route.ts", import.meta.url), "utf8");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("participantCount");
    expect(source).toContain("canJoinVoiceChannel");
  });
});
