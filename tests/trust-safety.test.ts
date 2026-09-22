import { describe, expect, it } from "vitest";
import { assessMessageSafety } from "../lib/trust-safety";

describe("Trust & Safety message assessment", () => {
  it("allows ordinary conversation", () => {
    const result = assessMessageSafety("Привет! Кто сегодня идёт в голосовой канал?");
    expect(result.flagged).toBe(false);
    expect(result.autoHide).toBe(false);
    expect(result.category).toBeNull();
  });

  it("auto-hides explicit threats", () => {
    const result = assessMessageSafety("Я тебя убью");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("threat");
    expect(result.severity).toBe("high");
    expect(result.autoHide).toBe(true);
  });

  it("flags harassment without automatically hiding medium severity", () => {
    const result = assessMessageSafety("Ты идиот, заткнись");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("harassment");
    expect(result.severity).toBe("medium");
    expect(result.autoHide).toBe(false);
  });

  it("flags suspicious profit links as fraud", () => {
    const result = assessMessageSafety("Гарантированный доход на крипте: https://example.com/win");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("fraud");
  });

  it("detects likely payment data", () => {
    const result = assessMessageSafety("Моя карта 4111 1111 1111 1111");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("personal_data");
  });

  it("detects mass links as spam", () => {
    const result = assessMessageSafety("https://a.example https://b.example https://c.example");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("spam");
  });

  it("normalizes unicode before assessment", () => {
    const result = assessMessageSafety("Ｉ ＷＩＬＬ ＫＩＬＬ ＹＯＵ");
    expect(result.flagged).toBe(true);
    expect(result.category).toBe("threat");
  });

  it("does not flag empty content", () => {
    const result = assessMessageSafety("   ");
    expect(result).toEqual({
      flagged: false,
      category: null,
      severity: "low",
      confidence: 0,
      summary: "",
      signals: [],
      autoHide: false,
    });
  });
});
