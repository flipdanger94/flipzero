"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";

type CreatedSpace = { id: string; name: string; slug: string; description: string | null; accentColor: string; channels: Array<{ id: string; name: string; kind: string; topic: string | null }> };

export function CreateSpaceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (space: CreatedSpace) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/spaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), description: data.get("description"), visibility: data.get("visibility"), accentColor: data.get("accentColor") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось создать пространство."); setLoading(false); return; }
    onCreated(result.space);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="space-dialog" role="dialog" aria-modal="true" aria-labelledby="create-space-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>
      <div className="dialog-symbol"><Sparkles size={23} /></div>
      <h2 id="create-space-title">Новое пространство</h2>
      <p>Создайте место для команды, друзей или своего сообщества.</p>
      <form onSubmit={submit}>
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <label><span>Название</span><input name="name" minLength={2} maxLength={48} placeholder="Например, Ночной клуб" autoFocus required /></label>
        <label><span>Описание</span><textarea name="description" maxLength={240} placeholder="О чём ваше пространство?" rows={3} /></label>
        <div className="dialog-row">
          <label><span>Доступ</span><select name="visibility" defaultValue="invite_only"><option value="invite_only">По приглашению</option><option value="public">Открытое</option><option value="application">По заявке</option><option value="private">Закрытое</option></select></label>
          <label><span>Акцент</span><input className="color-input" name="accentColor" type="color" defaultValue="#ff5c70" /></label>
        </div>
        <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Создаём...</> : "Создать пространство"}</button>
      </form>
    </section>
  </div>;
}
