import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeSpaceBanner } from "../lib/banner-image";

describe("space banner normalization", () => {
  it("crops a portrait upload without stretching and centers the visible region", async () => {
    const image = await sharp({ create: { width: 600, height: 1200, channels: 3, background: "#ec4274" } }).png().toBuffer();
    const result = await normalizeSpaceBanner(image, "image/png", 4 * 1024 * 1024);
    const metadata = await sharp(result.bytes).metadata();
    expect([metadata.width, metadata.height, result.contentType]).toEqual([960, 540, "image/webp"]);
    const pixel = await sharp(result.bytes).extract({ left: 480, top: 270, width: 1, height: 1 }).raw().toBuffer();
    expect(pixel[0]).toBeGreaterThan(200);
    expect(pixel[1]).toBeLessThan(110);
  });

  it("rejects tiny input before upscaling", async () => {
    const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(normalizeSpaceBanner(image, "image/png", 4 * 1024 * 1024)).rejects.toThrow("слишком маленькое");
  });

  it("keeps GIF output as GIF with the banner dimensions", async () => {
    const image = await sharp({ create: { width: 400, height: 400, channels: 4, background: "#4938dd" } }).gif().toBuffer();
    const result = await normalizeSpaceBanner(image, "image/gif", 4 * 1024 * 1024);
    const metadata = await sharp(result.bytes).metadata();
    expect([result.contentType, metadata.width, metadata.height]).toEqual(["image/gif", 960, 540]);
  });
});
