import { describe, expect, it } from "vitest";
import { voiceGridLayout } from "../lib/voice-layout";

describe("voiceGridLayout", () => {
  it.each([
    [0, "one", 1],
    [1, "one", 1],
    [2, "two", 2],
    [3, "three", 3],
    [4, "four", 2],
    [5, "five-nine", 3],
    [9, "five-nine", 3],
    [10, "ten-plus", 4],
    [50, "ten-plus", 4],
  ] as const)("lays out %i participants", (count, key, columns) => {
    expect(voiceGridLayout(count)).toEqual({ key, columns });
  });
});
