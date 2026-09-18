"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, Settings2, X } from "lucide-react";

export type EditableSpace = { id: string; name: string; description: string | null; visibility?: string; accentColor: string };

export function SpaceSettingsDialog({ space, onClose, onSaved }: { space: EditableSpace; onClose: () => void; onSaved: (space: EditableSpace) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/spaces/${space.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), description: data.get("description"), visibility: data.get("visibility"), accentColor: data.get("accentColor") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось сохранить настройки."); setLoading(false); return; }
    onSaved(result.space);
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Settings2 size={22} /></div><h2 id="settings-title">Настройки пространства</h2><p>Эти данные видят все участники сообщества.</p><form onSubmit={submit}>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label><span>Название</span><input name="name" defaultValue={space.name} minLength={2} maxLength={48} required /></label><label><span>Описание</span><textarea name="description" defaultValue={space.description ?? ""} maxLength={240} rows={3} /></label><div className="dialog-row"><label><span>Доступ</span><select name="visibility" defaultValue={space.visibility ?? "invite_only"}><option value="invite_only">По приглашению</option><option value="public">Открытое</option><option value="application">По заявке</option><option value="private">Закрытое</option></select></label><label><span>Акцент</span><input className="color-input" name="accentColor" type="color" defaultValue={space.accentColor} /></label></div><button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Сохраняем...</> : "Сохранить настройки"}</button></form></section></div>;
}
