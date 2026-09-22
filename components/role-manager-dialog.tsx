"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Permission } from "@/lib/permissions";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Role = { id: string; name: string; color: string; position: number; permissions: number; isManaged: boolean };
const permissionOptions = [
  ["Просмотр каналов", Permission.ViewChannels], ["Отправка сообщений", Permission.SendMessages],
  ["Управление сообщениями", Permission.ManageMessages], ["Управление каналами", Permission.ManageChannels],
  ["Управление ролями", Permission.ManageRoles], ["Настройки пространства", Permission.ManageSpace],
  ["Создание приглашений", Permission.CreateInvites], ["Исключение участников", Permission.KickMembers],
  ["Блокировка участников", Permission.BanMembers], ["Модерация участников", Permission.ModerateMembers],
  ["Подключение к голосу", Permission.ConnectVoice], ["Голос и трансляции", Permission.SpeakVoice | Permission.Stream],
] as const;

export function RoleManagerDialog({spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  const [items, setItems] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => items.find((role) => role.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    fetch(`/api/v1/spaces/${spaceId}/roles`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
      if (!response.ok) throw new Error(data.message);
      setItems(data.roles);
      setSelectedId(data.roles.find((role: Role) => !role.isManaged)?.id ?? data.roles[0]?.id ?? null);
    }).catch((reason) => setError(reason.message ?? "Не удалось загрузить роли.")).finally(() => setLoading(false));
  }, [spaceId]);

  async function createRole() {
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/roles`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Новая роль", color: "#7c6df2", permissions: Permission.ViewChannels | Permission.SendMessages }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось создать роль.");
    setItems((current) => [...current, data.role]); setSelectedId(data.role.id);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const permissions = permissionOptions.reduce((value, [, flag]) => form.get(`permission-${flag}`) ? value | flag : value, 0);
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/roles`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, name: form.get("name"), color: form.get("color"), permissions }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить роль.");
    setItems((current) => current.map((role) => role.id === data.role.id ? data.role : role));
  }

  async function removeRole() {
    if (!selected || !window.confirm(`Удалить роль «${selected.name}»?`)) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/roles?roleId=${selected.id}`, { method: "DELETE" });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось удалить роль.");
    const next = items.filter((role) => role.id !== selected.id); setItems(next); setSelectedId(next.find((role) => !role.isManaged)?.id ?? next[0]?.id ?? null);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog role-dialog" role="dialog" aria-modal="true" aria-labelledby="roles-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><ShieldCheck size={22} /></div><h2 id="roles-title">Роли и права</h2><p>Создавайте уровни доступа для участников пространства.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем роли...</div> : <div className="role-layout"><aside className="role-list">{items.map((role) => <button key={role.id} className={role.id === selectedId ? "active" : ""} onClick={() => setSelectedId(role.id)}><i style={{ background: role.color }} /><span>{role.name}</span>{role.isManaged ? <small>системная</small> : null}</button>)}<button className="role-add" onClick={createRole} disabled={saving}><Plus size={15} /> Создать роль</button></aside><div className="role-editor">{selected ? selected.isManaged ? <div className="role-protected"><ShieldCheck size={30} /><strong>{selected.name}</strong><span>Системная роль защищена от изменений.</span></div> : <form key={selected.id} onSubmit={save}><div className="dialog-row"><label><span>Название</span><input name="name" defaultValue={selected.name} minLength={2} maxLength={32} required /></label><label><span>Цвет</span><input className="color-input" name="color" type="color" defaultValue={selected.color} /></label></div><fieldset><legend>Разрешения</legend>{permissionOptions.map(([label, flag]) => <label className="permission-toggle" key={flag}><input type="checkbox" name={`permission-${flag}`} defaultChecked={(selected.permissions & flag) === flag} /><span>{label}</span></label>)}</fieldset><div className="role-actions"><button type="button" className="danger-button" onClick={removeRole} disabled={saving}><Trash2 size={15} /> Удалить</button><button className="auth-submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : "Сохранить роль"}</button></div></form> : <div className="role-protected"><Plus size={28} /><strong>Создайте роль</strong><span>Задайте цвет и права доступа.</span></div>}</div></div>}</section></div>;
}
