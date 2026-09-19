"use client";

import { useState } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";

type ImageKind = "avatar" | "accountBanner" | "spaceIcon" | "spaceBanner";

export function ImageUpload({ kind, spaceId, label, currentUrl, onUploaded }: { kind: ImageKind; spaceId?: string; label: string; currentUrl?: string | null; onUploaded: (result: { user?: Record<string, unknown>; space?: Record<string, unknown> }) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    const limit = kind.endsWith("Banner") ? 4 : 2;
    if (file.size > limit * 1024 * 1024) { setError(`Максимальный размер: ${limit} МБ.`); return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("kind", kind);
      if (spaceId) body.append("spaceId", spaceId);
      body.append("file", file);
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
  return <div className="image-upload"><label className="image-upload-button">{busy ? <LoaderCircle size={16} className="spin" /> : <Camera size={16} />} {busy ? "Обрабатываем…" : label}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(event) => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>{currentUrl ? <button type="button" className="image-remove-button" aria-label={`Удалить: ${label}`} title={`Удалить: ${label}`} onClick={() => void remove()} disabled={busy}><Trash2 size={16} /></button> : null}{error ? <small role="alert" className="image-upload-error">{error}</small> : null}</div>;
}
