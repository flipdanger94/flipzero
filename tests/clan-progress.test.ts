import { describe, expect, it } from "vitest";
import { clanLevel, validTagColor, validTagIcon } from "../lib/clan-progress";

describe("clan progress",()=>{
  it("moves to the next level exactly at configured XP thresholds",()=>{
    expect(clanLevel(0)).toBe(1);
    expect(clanLevel(999)).toBe(1);
    expect(clanLevel(1000)).toBe(2);
    expect(clanLevel(50000)).toBe(7);
  });
  it("rejects arbitrary styles and icons before saving",()=>{
    expect(validTagColor("#12abEF")).toBe(true);
    expect(validTagColor("red; background:url(x)")).toBe(false);
    expect(validTagIcon("crown")).toBe(true);
    expect(validTagIcon("custom-svg")).toBe(false);
  });
});
