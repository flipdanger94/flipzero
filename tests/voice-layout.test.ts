import { describe, expect, it } from "vitest";
import { voiceGridLayout } from "../lib/voice-layout";

describe("voice grid layout",()=>{
  it("uses explicit layouts for 1, 2, 3 and 4 participants",()=>{
    expect(voiceGridLayout(1)).toEqual({columns:1,rows:1,visible:1});
    expect(voiceGridLayout(2)).toEqual({columns:2,rows:1,visible:2});
    expect(voiceGridLayout(3)).toEqual({columns:3,rows:1,visible:3});
    expect(voiceGridLayout(4)).toEqual({columns:2,rows:2,visible:4});
  });
  it("uses three columns for 5–9 and four columns for 10+",()=>{
    expect(voiceGridLayout(5)).toEqual({columns:3,rows:2,visible:5});
    expect(voiceGridLayout(9)).toEqual({columns:3,rows:3,visible:9});
    expect(voiceGridLayout(10)).toEqual({columns:4,rows:3,visible:10});
  });
  it("supports compact mode and caps simultaneously rendered tiles",()=>{
    expect(voiceGridLayout(10,true).columns).toBe(5);
    expect(voiceGridLayout(80).visible).toBe(50);
  });
});
