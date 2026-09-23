import "server-only";
import sharp from "sharp";

/** Decode and store every space banner as a real 16:9 image. Animated GIF stays animated. */
export async function normalizeSpaceBanner(input: Buffer, sourceType: string, maxBytes: number) {
  const options = { animated: true, limitInputPixels: 40_000_000 };
  const metadata = await sharp(input, options).metadata();
  if (!metadata.width || !metadata.height || (metadata.pageHeight ?? metadata.height) < 180 || metadata.width < 320) {
    throw new Error("Изображение слишком маленькое. Выберите файл не менее 320×180 пикселей.");
  }
  if ((metadata.pages ?? 1) > 120 || metadata.width * (metadata.pageHeight ?? metadata.height) * (metadata.pages ?? 1) > 80_000_000) {
    throw new Error("Анимация слишком большая. Выберите более короткий GIF.");
  }
  const image = sharp(input, options).rotate().resize(960, 540, { fit: "cover", position: "centre" });
  const contentType = sourceType === "image/gif" ? "image/gif" : "image/webp";
  const bytes = contentType === "image/gif" ? await image.gif({ effort: 3 }).toBuffer() : await image.webp({ quality: 84, effort: 4 }).toBuffer();
  if (bytes.length > maxBytes) throw new Error(`После обработки изображение превышает ${Math.round(maxBytes / 1024 / 1024)} МБ. Выберите более короткий GIF или другое фото.`);
  return { bytes, contentType };
}
