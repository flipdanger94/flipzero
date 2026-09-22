"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, LoaderCircle, Save, ShieldCheck, X } from "lucide-react";
import { Permission } from "@/lib/permissions";
import { ChannelMemberOverrides } from "@/components/channel-member-overrides";

type Role = { id: string; name: string; color: string; isManaged: boolean };
type Override = { roleId: string; allow: number; deny: number };
type State = "inherit" | "allow" | "deny";
const permissionOptions = [
  ["Просмотр канала", Permission.ViewChannels], ["Отправка сообщений", Permission.SendMessages],
  ["Управление сообщениями", Permission.ManageMessages],
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
  const [channelSettings, setChannelSettings] = useState({ topic: "", slowmodeSeconds: 0, isNsfw: false });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const selected = useMemo(() => roles.find((role) => role.id === selectedId) ?? null, [roles, selectedId]);
  const current = items.find((item) => item.roleId === selectedId) ?? { roleId: selectedId ?? "", allow: 0, deny: 0 };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/channel-overrides?channelId=${encodeURIComponent(channel.id)}`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
      if (!response.ok) throw new Error(data.message);
      setRoles(data.roles); setItems(data.overrides); setSelectedId(data.roles[0]?.id ?? null); setChannelSettings({ topic: data.channel?.topic ?? "", slowmodeSeconds: Number(data.channel?.slowmodeSeconds ?? 0), isNsfw: Boolean(data.channel?.isNsfw) });
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
  async function saveChannelSettings() {
    setSettingsSaving(true); setSettingsSaved(false); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/channels`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, ...channelSettings }),
    });
    const data = await response.json().catch(() => null);
    setSettingsSaving(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось сохранить настройки канала.");
    setChannelSettings({
      topic: data.channel?.topic ?? "",
      slowmodeSeconds: Number(data.channel?.slowmodeSeconds ?? 0),
      isNsfw: Boolean(data.channel?.isNsfw),
    });
    setSettingsSaved(true);
  }

  async function save() {
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/channel-overrides`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId: channel.id, overrides: items }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить права.");
    setItems(data.overrides);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog channel-permissions-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-permissions-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Hash size={22} /></div><h2 id="channel-permissions-title">Настройки и права #{channel.name}</h2><p>Настройте канал и переопределите права ролей или отдельных участников.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}<section className="channel-settings-block"><div className="override-heading"><Hash size={20} /><div><strong>Настройки канала</strong><span>Описание, медленный режим и возрастное ограничение.</span></div></div><label><span>Описание</span><textarea value={channelSettings.topic} maxLength={240} rows={2} onChange={(event) => { setSettingsSaved(false); setChannelSettings((current) => ({ ...current, topic: event.target.value })); }} /></label><div className="channel-settings-row"><label><span>Медленный режим</span><select value={channelSettings.slowmodeSeconds} onChange={(event) => { setSettingsSaved(false); setChannelSettings((current) => ({ ...current, slowmodeSeconds: Number(event.target.value) })); }}><option value={0}>Выключен</option><option value={5}>5 секунд</option><option value={10}>10 секунд</option><option value={15}>15 секунд</option><option value={30}>30 секунд</option><option value={60}>1 минута</option><option value={300}>5 минут</option><option value={600}>10 минут</option><option value={3600}>1 час</option><option value={21600}>6 часов</option></select></label><label className="channel-nsfw-toggle"><input type="checkbox" checked={channelSettings.isNsfw} onChange={(event) => { setSettingsSaved(false); setChannelSettings((current) => ({ ...current, isNsfw: event.target.checked })); }} /><span>Канал 18+</span></label></div><button className="auth-submit override-save" onClick={saveChannelSettings} disabled={settingsSaving}>{settingsSaving ? <LoaderCircle className="spin" size={17} /> : <><Save size={16} /> {settingsSaved ? "Сохранено" : "Сохранить канал"}</>}</button></section>{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем настройки...</div> : <div className="channel-permissions-layout"><aside className="role-list">{roles.map((role) => <button key={role.id} className={role.id === selectedId ? "active" : ""} onClick={() => setSelectedId(role.id)}><i style={{ background: role.color }} /><span>{role.name}</span>{role.isManaged ? <small>системная</small> : null}</button>)}</aside><div className="override-editor">{selected ? <><div className="override-heading"><ShieldCheck size={20} /><div><strong>{selected.name}</strong><span>Базовые права применяются при значении «Наследовать».</span></div></div><div className="override-grid">{permissionOptions.map(([label, flag]) => <label key={flag}><span>{label}</span><select value={stateFor(flag)} onChange={(event) => change(flag, event.target.value as State)}><option value="inherit">Наследовать</option><option value="allow">Разрешить</option><option value="deny">Запретить</option></select></label>)}</div><button className="auth-submit override-save" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <><Save size={16} /> Сохранить права</>}</button></> : <div className="role-protected"><ShieldCheck size={30} /><strong>Роли не найдены</strong></div>}</div></div>}<ChannelMemberOverrides spaceId={spaceId} channelId={channel.id} /></section></div>;
}
