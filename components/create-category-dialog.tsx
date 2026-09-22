"use client";

import { type FormEvent, useState } from "react";
import { FolderPlus, LoaderCircle, X } from "lucide-react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

export type CreatedCategory = { id: string; spaceId: string; name: string; position: number };

export function CreateCategoryDialog({spaceId, onClose, onCreated }: { spaceId: string; onClose: () => void; onCreated: (category: CreatedCategory) => void }) {
  const dialogRef = useModalA11y(onClose);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/spaces/${spaceId}/categories`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name") }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "Не удалось создать категорию."); setLoading(false); return; }
    onCreated(result.category);
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog" role="dialog" aria-modal="true" aria-labelledby="category-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><FolderPlus size={22} /></div><h2 id="category-title">Новая категория</h2><p>Объедините каналы по теме или назначению.</p><form onSubmit={submit}>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label><span>Название</span><input name="name" minLength={2} maxLength={32} placeholder="Например, Проекты" autoFocus required /></label><button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Создаём...</> : "Создать категорию"}</button></form></section></div>;
}
