"use client";

import { useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";

type ImageKind = "avatar" | "accountBanner" | "spaceIcon" | "spaceBanner";

async function prepareImage(file: File, limit: number, banner: boolean): Promise<File> {
  if (file.size > 30 * 1024 * 1024) throw new Error("Выберите фото размером до 30 МБ.");
  if (file.type === "image/gif") {
    if (file.size > limit) throw new Error("Анимированный GIF слишком большой. Выберите файл меньшего размера.");
    return file;
  }
  const supported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const heic = ["image/heic", "image/heif"].includes(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!supported && !heic) throw new Error("Поддерживаются PNG, JPEG, WebP, GIF и фото HEIC с iPhone.");
  if (supported && file.size <= limit) return file;

  const sourceUrl = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = new Image();
    image.src = sourceUrl;
    await image.decode();
  } catch {
    throw new Error("Не удалось открыть фото. Сохраните его в JPEG или PNG и попробуйте снова.");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
  const canvas = document.createElement("canvas");
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error("Файл не содержит изображения.");
  let scale = Math.min(1, (banner ? 2400 : 1200) / longestSide);
  for (let attempt = 0; attempt < 5; attempt++) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Этот браузер не смог обработать фото.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", attempt < 2 ? 0.86 : 0.72));
    if (blob?.size && blob.size <= limit) return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    scale *= 0.7;
  }
  throw new Error("Не удалось уменьшить фото. Выберите другое изображение.");
}

export function ImageUpload({ kind, spaceId, label, currentUrl, onUploaded }: { kind: ImageKind; spaceId?: string; label: string; currentUrl?: string | null; onUploaded: (result: { user?: Record<string, unknown>; space?: Record<string, unknown> }) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    const limit = (kind.endsWith("Banner") ? 4 : 2) * 1024 * 1024;
    setBusy(true);
    try {
      const prepared = await prepareImage(file, limit, kind.endsWith("Banner"));
      const body = new FormData();
      body.append("kind", kind);
      if (spaceId) body.append("spaceId", spaceId);
      body.append("file", prepared);
      const response = await fetch("/api/v1/media", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Не удалось загрузить изображение.");
      onUploaded(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить изображение."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/v1/media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, spaceId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Не удалось удалить изображение.");
      onUploaded(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось удалить изображение."); }
    finally { setBusy(false); }
  }
  return <div className="image-upload"><label className="image-upload-button">{busy ? <LoaderCircle size={16} className="spin" /> : <Camera size={16} />} {busy ? "Обрабатываем…" : label}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif" disabled={busy} onChange={(event) => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>{currentUrl ? <button type="button" className="image-remove-button" aria-label={`Удалить: ${label}`} title={`Удалить: ${label}`} onClick={() => void remove()} disabled={busy}><Trash2 size={16} /></button> : null}{error ? <small role="alert" className="image-upload-error">{error}</small> : null}</div>;
}
