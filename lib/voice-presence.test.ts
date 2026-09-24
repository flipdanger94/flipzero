import { describe, expect, it } from "vitest";
import { normalizeVoicePresence, type VoicePresence } from "./voice-presence";

describe("normalizeVoicePresence", () => {
  it("deduplicates multiple sessions for the same userId and merges state", () => {
    const input: VoicePresence[] = [
      { id:"u1", name:"Alex", avatarUrl:null, muted:true, deafened:true, camera:false, sharing:false, streaming:false, speaking:false },
      { id:"u1", name:"Alex", avatarUrl:"/avatar.png", muted:false, deafened:false, camera:true, sharing:true, streaming:true, speaking:true },
      { id:"u2", name:"Poka", muted:false, camera:false, sharing:false, speaking:false },
    ];
    const result = normalizeVoicePresence(input);
    expect(result).toHaveLength(2);
    expect(result.find((item)=>item.id==="u1")).toMatchObject({
      avatarUrl:"/avatar.png",
      muted:false,
      deafened:false,
      camera:true,
      sharing:true,
      streaming:true,
      speaking:true,
    });
  });
});
