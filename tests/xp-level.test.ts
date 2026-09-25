import { describe, expect, it } from "vitest";
import { levelFromXp, totalXpForLevel } from "../lib/gamification";

describe("account XP level formula", () => {
  it("matches level boundaries exactly", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(282);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(281)).toBe(2);
    expect(levelFromXp(282)).toBe(3);
  });

  it("caps account level at 100", () => {
    expect(levelFromXp(totalXpForLevel(100))).toBe(100);
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(100);
  });

  it("allows different users to share the same level", () => {
    expect(levelFromXp(215)).toBe(2);
    expect(levelFromXp(250)).toBe(2);
  });
});
