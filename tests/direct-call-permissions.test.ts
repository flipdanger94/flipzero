import { expect, it } from "vitest";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { directCallPublishSources } from "@/lib/direct-call-permissions";

it.each([false,true])("includes screen and screen audio in the signed call token (video=%s)",async video=>{
  const sources=directCallPublishSources(video);
  expect(sources).toContain(TrackSource.SCREEN_SHARE);
  expect(sources).toContain(TrackSource.SCREEN_SHARE_AUDIO);
  expect(sources.includes(TrackSource.CAMERA)).toBe(video);
  const token=new AccessToken("test-key","test-secret-that-is-long-enough",{identity:"caller"});
  token.addGrant({roomJoin:true,room:"test-room",canPublish:true,canPublishSources:sources,canSubscribe:true});
  const claims=JSON.parse(Buffer.from((await token.toJwt()).split('.')[1],"base64url").toString());
  expect(claims.video.canPublishSources).toContain("screen_share");
  expect(claims.video.canPublishSources).toContain("screen_share_audio");
});
