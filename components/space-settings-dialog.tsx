"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Crown, LoaderCircle, Settings2, X } from "lucide-react";
import { ImageUpload } from "./image-upload";
import { MediaImage } from "./media-image";

export type EditableSpace = { id: string; name: string; description: string | null; visibility?: string; accentColor: string; iconUrl?: string | null; bannerUrl?: string | null; ownerId?: string; permissions?: number };

export function SpaceSettingsDialog({ space, isOwner = false, onClose, onSaved }: { space: EditableSpace; isOwner?: boolean; onClose: () => void; onSaved: (space: EditableSpace, close?: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState({ iconUrl: space.iconUrl, bannerUrl: space.bannerUrl });
  const [members, setMembers] = useState<Array<{ userId: string; displayName: string; username: string }>>([]);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferWorking, setTransferWorking] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${space.id}/members`, { signal: controller.signal })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) return;
        const available = (data.members ?? []).filter((member: { userId: string }) => member.userId !== space.ownerId);
        setMembers(available);
        setTransferTarget(available[0]?.userId ?? "");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isOwner, space.id, space.ownerId]);
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

  async function transferOwnership() {
    if (!transferTarget || transferWorking) return;
    const target = members.find((member) => member.userId === transferTarget);
    if (!target) return;
    const confirmation = window.prompt(`Передача владения необратима без согласия нового владельца. Введите точное название сервера: ${space.name}`);
    if (confirmation === null) return;
    setTransferWorking(true);
    setError("");
    const response = await fetch(`/api/v1/spaces/${space.id}/ownership`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: transferTarget, confirmation }),
    });
    const result = await response.json().catch(() => null);
    setTransferWorking(false);
    if (!response.ok) {
      setError(result?.message ?? "Не удалось передать владение.");
      return;
    }
    onSaved({ ...space, ownerId: result.ownerId, permissions: result.permissions }, true);
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Settings2 size={22} /></div><h2 id="settings-title">Настройки пространства</h2><p>Эти данные видят все участники сообщества.</p><div className="space-media-preview"><div className="space-media-banner" style={images.bannerUrl ? { backgroundImage: `url(${images.bannerUrl})` } : undefined} /><span className="space-media-icon">{images.iconUrl ? <MediaImage src={images.iconUrl} sizes="72px" /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</span></div><div className="space-media-controls"><ImageUpload kind="spaceIcon" spaceId={space.id} label="Аватарка сервера" currentUrl={images.iconUrl} onUploaded={mediaSaved} /><ImageUpload kind="spaceBanner" spaceId={space.id} label="Баннер сервера" currentUrl={images.bannerUrl} onUploaded={mediaSaved} /><small>Фото до 30 МБ уменьшаются автоматически · GIF до 2 МБ для аватарки и 4 МБ для баннера</small></div><form onSubmit={submit}>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label><span>Название</span><input name="name" defaultValue={space.name} minLength={2} maxLength={48} required /></label><label><span>Описание</span><textarea name="description" defaultValue={space.description ?? ""} maxLength={240} rows={3} /></label><div className="dialog-row"><label><span>Доступ</span><select name="visibility" defaultValue={space.visibility ?? "invite_only"}><option value="invite_only">По приглашению</option><option value="public">Открытое</option><option value="application">По заявке</option><option value="private">Закрытое</option></select></label><label><span>Акцент</span><input className="color-input" name="accentColor" type="color" defaultValue={space.accentColor} /></label></div><button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Сохраняем...</> : "Сохранить настройки"}</button></form>{isOwner ? <section className="ownership-transfer"><div><Crown size={18} /><span><strong>Передача владения</strong><small>Новый владелец получит полный контроль над сервером.</small></span></div>{members.length ? <><select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName} · @{member.username}</option>)}</select><button className="danger-button" onClick={transferOwnership} disabled={transferWorking || !transferTarget}>{transferWorking ? <LoaderCircle className="spin" size={16} /> : <Crown size={16} />} Передать владение</button></> : <small>Для передачи владения нужен хотя бы один другой участник.</small>}</section> : null}</section></div>;
}
