"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, LoaderCircle, Save, ShieldCheck, X } from "lucide-react";
import { Permission } from "@/lib/permissions";

type Role = { id: string; name: string; color: string; isManaged: boolean };
type Override = { roleId: string; allow: number; deny: number };
type State = "inherit" | "allow" | "deny";
const permissionOptions = [
  ["Просмотр канала", Permission.ViewChannels], ["Отправка сообщений", Permission.SendMessages],
  ["Управление сообщениями", Permission.ManageMessages], ["Управление каналом", Permission.ManageChannels],
  ["Подключение к голосу", Permission.ConnectVoice],
  ["Использование микрофона", Permission.SpeakVoice], ["Запуск трансляций", Permission.Stream],
] as const;

export function ChannelPermissionsDialog({ spaceId, channel, onClose }: { spaceId: string; channel: { id: string; name: string }; onClose: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [items, setItems] = useState<Override[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => roles.find((role) => role.id === selectedId) ?? null, [roles, selectedId]);
  const current = items.find((item) => item.roleId === selectedId) ?? { roleId: selectedId ?? "", allow: 0, deny: 0 };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/channel-overrides?channelId=${encodeURIComponent(channel.id)}`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
      if (!response.ok) throw new Error(data.message);
      setRoles(data.roles); setItems(data.overrides); setSelectedId(data.roles[0]?.id ?? null);
    }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить права канала."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [spaceId, channel.id]);

  function stateFor(flag: number): State { if ((current.allow & flag) === flag) return "allow"; if ((current.deny & flag) === flag) return "deny"; return "inherit"; }
  function change(flag: number, state: State) {
    if (!selectedId) return;
    setItems((existing) => {
      const found = existing.find((item) => item.roleId === selectedId) ?? { roleId: selectedId, allow: 0, deny: 0 };
      const next = { ...found, allow: found.allow & ~flag, deny: found.deny & ~flag };
      if (state === "allow") next.allow |= flag;
      if (state === "deny") next.deny |= flag;
      return [...existing.filter((item) => item.roleId !== selectedId), next];
    });
  }
  async function save() {
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/channel-overrides`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId: channel.id, overrides: items }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить права.");
    setItems(data.overrides);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog channel-permissions-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-permissions-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Hash size={22} /></div><h2 id="channel-permissions-title">Права канала #{channel.name}</h2><p>Переопределите общие права ролей только для этого канала.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем настройки...</div> : <div className="channel-permissions-layout"><aside className="role-list">{roles.map((role) => <button key={role.id} className={role.id === selectedId ? "active" : ""} onClick={() => setSelectedId(role.id)}><i style={{ background: role.color }} /><span>{role.name}</span>{role.isManaged ? <small>системная</small> : null}</button>)}</aside><div className="override-editor">{selected ? <><div className="override-heading"><ShieldCheck size={20} /><div><strong>{selected.name}</strong><span>Базовые права применяются при значении «Наследовать».</span></div></div><div className="override-grid">{permissionOptions.map(([label, flag]) => <label key={flag}><span>{label}</span><select value={stateFor(flag)} onChange={(event) => change(flag, event.target.value as State)}><option value="inherit">Наследовать</option><option value="allow">Разрешить</option><option value="deny">Запретить</option></select></label>)}</div><button className="auth-submit override-save" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <><Save size={16} /> Сохранить права</>}</button></> : <div className="role-protected"><ShieldCheck size={30} /><strong>Роли не найдены</strong></div>}</div></div>}</section></div>;
}
