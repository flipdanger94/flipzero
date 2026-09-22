"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Clock3, FilePlus2, History, LoaderCircle, Pencil, Search, Trash2, X } from "lucide-react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type WikiPage = { id: string; slug: string; title: string; summary: string | null; content: string; revision: number; createdAt: string; updatedAt: string };
type Revision = { id: string; revision: number; title: string; createdAt: string };

export function WikiDialog({
  const dialogRef = useModalA11y(onClose); spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"read" | "create" | "edit">("read");
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/spaces/${spaceId}/wiki`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); const loaded = data.pages ?? []; setPages(loaded); setSelectedId(loaded[0]?.id ?? null); setIsOwner(Boolean(data.isOwner)); }).catch((reason) => setError(reason.message ?? "Не удалось загрузить базу знаний.")).finally(() => setLoading(false));
  }, [spaceId]);

  const selected = pages.find((page) => page.id === selectedId) ?? null;
  const filtered = useMemo(() => { const value = query.trim().toLocaleLowerCase("ru"); return pages.filter((page) => !value || page.title.toLocaleLowerCase("ru").includes(value) || page.summary?.toLocaleLowerCase("ru").includes(value) || page.content.toLocaleLowerCase("ru").includes(value)); }, [pages, query]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/spaces/${spaceId}/wiki`, { method: mode === "edit" ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected?.id, title: form.get("title"), summary: form.get("summary"), content: form.get("content") }) });
    const data = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось сохранить статью.");
    setPages((current) => mode === "edit" ? current.map((page) => page.id === data.page.id ? data.page : page) : [data.page, ...current]);
    setSelectedId(data.page.id); setMode("read"); setHistory(null);
  }

  async function remove() {
    if (!selected || !window.confirm(`Удалить статью «${selected.title}»?`)) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/wiki?pageId=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось удалить статью.");
    setPages((current) => { const next = current.filter((page) => page.id !== selected.id); setSelectedId(next[0]?.id ?? null); return next; }); setHistory(null);
  }

  async function showHistory() {
    if (!selected) return;
    if (history) return setHistory(null);
    const response = await fetch(`/api/v1/spaces/${spaceId}/wiki?history=${encodeURIComponent(selected.id)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return setError(data?.message ?? "Не удалось загрузить историю.");
    setHistory(data.revisions ?? []);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog wiki-dialog" role="dialog" aria-modal="true" aria-labelledby="wiki-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><header className="wiki-heading"><span className="dialog-symbol"><BookOpen size={22} /></span><div><h2 id="wiki-title">База знаний</h2><p>Правила, инструкции и полезные материалы сообщества.</p></div>{isOwner ? <button onClick={() => { setMode("create"); setHistory(null); }}><FilePlus2 size={16} /> Новая статья</button> : null}</header>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="wiki-state"><LoaderCircle className="spin" size={25} /> Загружаем статьи...</div> : <div className="wiki-layout"><aside><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по Wiki" /></label><div>{filtered.map((page) => <button key={page.id} className={page.id === selectedId && mode === "read" ? "active" : ""} onClick={() => { setSelectedId(page.id); setMode("read"); setHistory(null); }}><BookOpen size={15} /><span><strong>{page.title}</strong><small>{page.summary || `Версия ${page.revision}`}</small></span></button>)}{!filtered.length ? <div className="wiki-empty-list">Статьи не найдены</div> : null}</div></aside><main>{mode === "create" || mode === "edit" ? <form className="wiki-editor" onSubmit={save}><div><small>{mode === "create" ? "НОВАЯ СТАТЬЯ" : `РЕДАКТИРОВАНИЕ · ВЕРСИЯ ${(selected?.revision ?? 0) + 1}`}</small><h3>{mode === "create" ? "Создать материал" : "Обновить статью"}</h3></div><label><span>Название</span><input name="title" defaultValue={mode === "edit" ? selected?.title : ""} minLength={2} maxLength={100} autoFocus required /></label><label><span>Краткое описание</span><input name="summary" defaultValue={mode === "edit" ? selected?.summary ?? "" : ""} maxLength={240} /></label><label className="wiki-content-input"><span>Содержание</span><textarea name="content" defaultValue={mode === "edit" ? selected?.content : ""} minLength={10} maxLength={20000} placeholder="Напишите текст статьи. Используйте пустые строки для разделения абзацев." required /></label><div className="wiki-form-actions"><button type="button" onClick={() => setMode("read")}>Отмена</button><button className="auth-submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : "Сохранить статью"}</button></div></form> : selected ? <article className="wiki-reader"><div className="wiki-reader-head"><div><small>ОБНОВЛЕНО {new Date(selected.updatedAt).toLocaleDateString("ru-RU")} · ВЕРСИЯ {selected.revision}</small><h1>{selected.title}</h1>{selected.summary ? <p>{selected.summary}</p> : null}</div>{isOwner ? <div><button onClick={showHistory} title="История версий"><History size={16} /></button><button onClick={() => setMode("edit")} title="Редактировать"><Pencil size={16} /></button><button onClick={remove} title="Удалить"><Trash2 size={16} /></button></div> : null}</div>{history ? <section className="wiki-history"><h3><History size={15} /> История версий</h3>{history.map((revision) => <div key={revision.id}><strong>Версия {revision.revision}</strong><span>{revision.title}</span><time><Clock3 size={12} /> {new Date(revision.createdAt).toLocaleString("ru-RU")}</time></div>)}</section> : null}<div className="wiki-body">{selected.content}</div></article> : <div className="wiki-state"><BookOpen size={34} /><strong>База знаний пока пуста</strong><span>{isOwner ? "Создайте первую статью для сообщества." : "Владелец ещё не добавил материалы."}</span></div>}</main></div>}</section></div>;
}
