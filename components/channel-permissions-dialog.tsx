"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Hash, LoaderCircle, Minus, Save, Search, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { Permission } from "@/lib/permissions";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Role = { id: string; name: string; color: string; isManaged: boolean };
type Member = { id: string; username: string; displayName: string; avatarUrl: string | null };
type Override = { targetId: string; targetType: "role" | "member"; allow: number; deny: number };
type State = "inherit" | "allow" | "deny";
type PermissionItem = { label: string; description: string; flag: number; group: "Основные" | "Сообщения" | "Управление" | "Голос" };

const textPermissions: PermissionItem[] = [
  { label: "Просмотр канала", description: "Видеть канал в списке и открывать его.", flag: Permission.ViewChannels, group: "Основные" },
  { label: "История сообщений", description: "Читать предыдущие сообщения канала.", flag: Permission.ReadHistory, group: "Основные" },
  { label: "Отправка сообщений", description: "Писать новые сообщения в этом канале.", flag: Permission.SendMessages, group: "Сообщения" },
  { label: "Добавлять реакции", description: "Ставить emoji-реакции на сообщения.", flag: Permission.AddReactions, group: "Сообщения" },
  { label: "Прикреплять файлы", description: "Отправлять вложения и голосовые сообщения.", flag: Permission.AttachFiles, group: "Сообщения" },
  { label: "Встраивать ссылки", description: "Показывать расширенные превью ссылок.", flag: Permission.EmbedLinks, group: "Сообщения" },
  { label: "Упоминать роли", description: "Использовать @роль в сообщениях.", flag: Permission.MentionRoles, group: "Сообщения" },
  { label: "Управление сообщениями", description: "Удалять и закреплять сообщения других участников.", flag: Permission.ManageMessages, group: "Управление" },
  { label: "Управление каналом", description: "Менять настройки и права этого канала.", flag: Permission.ManageChannels, group: "Управление" },
  { label: "Создание приглашений", description: "Создавать приглашения в пространство из канала.", flag: Permission.CreateInvites, group: "Управление" },
];
const voicePermissions: PermissionItem[] = [
  { label: "Подключение к голосу", description: "Подключаться к голосовому каналу.", flag: Permission.ConnectVoice, group: "Голос" },
  { label: "Использование микрофона", description: "Говорить и включать камеру.", flag: Permission.SpeakVoice, group: "Голос" },
  { label: "Запуск трансляций", description: "Демонстрировать экран в голосовом канале.", flag: Permission.Stream, group: "Голос" },
];

export function ChannelPermissionsDialog({spaceId, channel, onClose }: { spaceId: string; channel: { id: string; name: string; kind: string }; onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  const [roles, setRoles] = useState<Role[]>([]), [members, setMembers] = useState<Member[]>([]), [items, setItems] = useState<Override[]>([]);
  const [selected, setSelected] = useState<{ id: string; type: "role" | "member" } | null>(null);
  const [targetQuery, setTargetQuery] = useState(""), [permissionQuery, setPermissionQuery] = useState(""), [targetTab, setTargetTab] = useState<"roles" | "members">("roles");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  const targets = useMemo(() => {
    const list = targetTab === "roles"
      ? roles.map((role) => ({ id: role.id, type: "role" as const, name: role.name, subtitle: role.isManaged ? "Системная роль" : "Роль", color: role.color }))
      : members.map((member) => ({ id: member.id, type: "member" as const, name: member.displayName, subtitle: `@${member.username}`, color: undefined }));
    const query = targetQuery.trim().toLocaleLowerCase("ru");
    return list.filter((item) => !query || item.name.toLocaleLowerCase("ru").includes(query) || item.subtitle.toLocaleLowerCase("ru").includes(query));
  }, [roles, members, targetQuery, targetTab]);
  const selectedTarget = targets.find((item) => selected?.id === item.id && selected.type === item.type)
    ?? (selected?.type === "role" ? roles.filter((role)=>role.id===selected.id).map((role)=>({id:role.id,type:"role" as const,name:role.name,subtitle:role.isManaged?"Системная роль":"Роль",color:role.color}))[0] : members.filter((member)=>member.id===selected?.id).map((member)=>({id:member.id,type:"member" as const,name:member.displayName,subtitle:`@${member.username}`,color:undefined}))[0]) ?? null;
  const current = selected ? items.find((item) => item.targetId === selected.id && item.targetType === selected.type) ?? { targetId: selected.id, targetType: selected.type, allow: 0, deny: 0 } : null;
  const permissionItems = useMemo(() => {
    const all = [...textPermissions, ...(["voice", "stage"].includes(channel.kind) ? voicePermissions : [])];
    const query = permissionQuery.trim().toLocaleLowerCase("ru");
    return all.filter((item) => !query || item.label.toLocaleLowerCase("ru").includes(query) || item.description.toLocaleLowerCase("ru").includes(query));
  }, [channel.kind, permissionQuery]);
  const groups = [...new Set(permissionItems.map((item) => item.group))];

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/channel-overrides?channelId=${encodeURIComponent(channel.id)}`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
      if (!response.ok) throw new Error(data.message);
      setRoles(data.roles ?? []); setMembers(data.members ?? []); setItems(data.overrides ?? []);
      if (data.roles?.[0]) setSelected({ id: data.roles[0].id, type: "role" });
    }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить права канала."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [spaceId, channel.id]);

  function stateFor(flag: number): State { if (!current) return "inherit"; if ((current.allow & flag) === flag) return "allow"; if ((current.deny & flag) === flag) return "deny"; return "inherit"; }
  function change(flag: number, state: State) {
    if (!selected) return; setSaved(false);
    setItems((existing) => {
      const found = existing.find((item) => item.targetId === selected.id && item.targetType === selected.type) ?? { targetId: selected.id, targetType: selected.type, allow: 0, deny: 0 };
      const next = { ...found, allow: found.allow & ~flag, deny: found.deny & ~flag };
      if (state === "allow") next.allow |= flag; if (state === "deny") next.deny |= flag;
      return [...existing.filter((item) => !(item.targetId === selected.id && item.targetType === selected.type)), next];
    });
  }
  async function save() {
    setSaving(true); setSaved(false); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/channel-overrides`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId: channel.id, overrides: items }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить права.");
    setItems(data.overrides ?? []); setSaved(true);
  }

  return <div className="dialog-backdrop channel-permissions-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><section ref={dialogRef} tabIndex={-1} className="space-dialog channel-permissions-dialog discord-permissions-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-permissions-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19}/></button><div className="channel-permissions-title"><span className="dialog-symbol"><Hash size={22}/></span><div><small>НАСТРОЙКИ КАНАЛА</small><h2 id="channel-permissions-title">Права #{channel.name}</h2><p>{["voice","stage"].includes(channel.kind)?"Текстовые и голосовые права для ролей и участников.":"Для текстового канала показаны только релевантные права."}</p></div></div>{error?<div className="auth-error" role="alert">{error}</div>:null}{loading?<div className="role-loading"><LoaderCircle className="spin" size={22}/> Загружаем настройки...</div>:<div className="channel-permissions-layout discord-permissions-layout"><aside className="permission-targets"><div className="permission-target-tabs"><button className={targetTab==="roles"?"active":""} onClick={()=>setTargetTab("roles")}><ShieldCheck size={14}/>Роли</button><button className={targetTab==="members"?"active":""} onClick={()=>setTargetTab("members")}><Users size={14}/>Участники</button></div><label className="permission-search"><Search size={14}/><input value={targetQuery} onChange={(e)=>setTargetQuery(e.target.value)} placeholder={targetTab==="roles"?"Поиск ролей":"Поиск участников"}/></label><div className="permission-target-list">{targets.map((target)=><button key={target.type+target.id} className={selected?.id===target.id&&selected.type===target.type?"active":""} onClick={()=>setSelected({id:target.id,type:target.type})}>{target.type==="role"?<i style={{background:target.color}}/>:<span className="permission-member-icon"><UserRound size={14}/></span>}<span><strong>{target.name}</strong><small>{target.subtitle}</small></span></button>)}{!targets.length?<p>Ничего не найдено.</p>:null}</div></aside><div className="override-editor">{selectedTarget?<><div className="override-heading"><ShieldCheck size={20}/><div><strong>{selectedTarget.name}</strong><span>{selectedTarget.type==="role"?"Переопределения роли действуют только в этом канале.":"Личное переопределение применяется после ролей."}</span></div></div><label className="permission-search permission-search-right"><Search size={14}/><input value={permissionQuery} onChange={(e)=>setPermissionQuery(e.target.value)} placeholder="Поиск по правам"/></label><div className="permission-groups">{groups.map((group)=><section key={group}><h3>{group}</h3>{permissionItems.filter((item)=>item.group===group).map((item)=><article className="permission-row" key={item.flag}><div><strong>{item.label}</strong><span>{item.description}</span></div><div className="permission-tristate" role="group" aria-label={item.label}><button className={stateFor(item.flag)==="deny"?"active deny":""} onClick={()=>change(item.flag,"deny")} title="Запретить"><X size={16}/></button><button className={stateFor(item.flag)==="inherit"?"active inherit":""} onClick={()=>change(item.flag,"inherit")} title="Наследовать"><Minus size={16}/></button><button className={stateFor(item.flag)==="allow"?"active allow":""} onClick={()=>change(item.flag,"allow")} title="Разрешить"><Check size={16}/></button></div></article>)}</section>)}</div><div className="permission-savebar"><span>{saved?"Права сохранены":"Изменения применятся после сохранения."}</span><button className="auth-submit override-save" onClick={save} disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<><Save size={16}/>Сохранить изменения</>}</button></div></>:<div className="role-protected"><ShieldCheck size={30}/><strong>Выберите роль или участника</strong></div>}</div></div>}</section></div>;
}
