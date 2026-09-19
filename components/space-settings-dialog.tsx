"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, Settings2, X } from "lucide-react";
import { ImageUpload } from "./image-upload";

export type EditableSpace = { id: string; name: string; description: string | null; visibility?: string; accentColor: string; iconUrl?: string | null; bannerUrl?: string | null };

export function SpaceSettingsDialog({ space, onClose, onSaved }: { space: EditableSpace; onClose: () => void; onSaved: (space: EditableSpace, close?: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState({ iconUrl: space.iconUrl, bannerUrl: space.bannerUrl });
  function mediaSaved(result: { space?: Record<string, unknown> }) {
    const next = result.space as Partial<EditableSpace>;
    setImages((current) => ({ ...current, ...next }));
    onSaved({ ...space, ...images, ...next }, false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/spaces/${space.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), description: data.get("description"), visibility: data.get("visibility"), accentColor: data.get("accentColor") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось сохранить настройки."); setLoading(false); return; }
    onSaved(result.space);
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Settings2 size={22} /></div><h2 id="settings-title">Настройки пространства</h2><p>Эти данные видят все участники сообщества.</p><div className="space-media-preview"><div className="space-media-banner" style={images.bannerUrl ? { backgroundImage: `url(${images.bannerUrl})` } : undefined} /><span className="space-media-icon">{images.iconUrl ? <img src={images.iconUrl} alt="" /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</span></div><div className="space-media-controls"><ImageUpload kind="spaceIcon" spaceId={space.id} label="Аватарка сервера" onUploaded={mediaSaved} /><ImageUpload kind="spaceBanner" spaceId={space.id} label="Баннер сервера" onUploaded={mediaSaved} /><small>PNG, JPEG, WebP или GIF · до 2 МБ для аватарки и 4 МБ для баннера</small></div><form onSubmit={submit}>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label><span>Название</span><input name="name" defaultValue={space.name} minLength={2} maxLength={48} required /></label><label><span>Описание</span><textarea name="description" defaultValue={space.description ?? ""} maxLength={240} rows={3} /></label><div className="dialog-row"><label><span>Доступ</span><select name="visibility" defaultValue={space.visibility ?? "invite_only"}><option value="invite_only">По приглашению</option><option value="public">Открытое</option><option value="application">По заявке</option><option value="private">Закрытое</option></select></label><label><span>Акцент</span><input className="color-input" name="accentColor" type="color" defaultValue={space.accentColor} /></label></div><button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Сохраняем...</> : "Сохранить настройки"}</button></form></section></div>;
}
