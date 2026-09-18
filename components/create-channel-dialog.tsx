"use client";

import { type FormEvent, useState } from "react";
import { Hash, LoaderCircle, Volume2, X } from "lucide-react";

export type CreatedChannel = { id: string; spaceId: string; parentId: string | null; name: string; topic: string | null; kind: "text" | "voice"; position: number };
type CategoryOption = { id: string; name: string };

export function CreateChannelDialog({ spaceId, categories, initialKind, initialParentId, onClose, onCreated }: { spaceId: string; categories: CategoryOption[]; initialKind: "text" | "voice"; initialParentId?: string | null; onClose: () => void; onCreated: (channel: CreatedChannel) => void }) {
  const [kind, setKind] = useState<"text" | "voice">(initialKind);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const parentId = data.get("parentId");
    const response = await fetch(`/api/v1/spaces/${spaceId}/channels`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), topic: data.get("topic"), kind, parentId: parentId || null }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось создать канал."); setLoading(false); return; }
    onCreated(result.channel);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="space-dialog channel-dialog" role="dialog" aria-modal="true" aria-labelledby="create-channel-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>
      <h2 id="create-channel-title">Создать канал</h2><p>Выберите формат и задайте понятное название.</p>
      <div className="channel-kind-picker">
        <button className={kind === "text" ? "active" : ""} onClick={() => setKind("text")}><Hash size={20} /><span><strong>Текстовый</strong><small>Сообщения и обсуждения</small></span></button>
        <button className={kind === "voice" ? "active" : ""} onClick={() => setKind("voice")}><Volume2 size={20} /><span><strong>Голосовой</strong><small>Живое общение</small></span></button>
      </div>
      <form onSubmit={submit}>
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <label><span>Название канала</span><input name="name" minLength={2} maxLength={48} placeholder={kind === "text" ? "новый-канал" : "Лаунж"} autoFocus required /></label>
        <label><span>Категория</span><select name="parentId" defaultValue={initialParentId ?? ""}><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label><span>Описание</span><textarea name="topic" maxLength={240} placeholder="Для чего этот канал?" rows={2} /></label>
        <button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Создаём...</> : "Создать канал"}</button>
      </form>
    </section>
  </div>;
}
