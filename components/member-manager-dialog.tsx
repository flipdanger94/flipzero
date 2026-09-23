"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Save, UserMinus, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Role = { id: string; name: string; color: string; isManaged: boolean };
type Member = { userId: string; username: string; displayName: string; nickname: string | null; level: number; joinedAt: string; avatarUrl?: string | null; roleIds: string[]; superupSupporter?: boolean };

export function MemberManagerDialog({spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  const [items, setItems] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => items.find((member) => member.userId === selectedId) ?? null, [items, selectedId]);
  const customRoles = roles.filter((role) => !role.isManaged);

  useEffect(() => { fetch(`/api/v1/spaces/${spaceId}/members?limit=100`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
    if (!response.ok) throw new Error(data.message);
    setItems(data.members);
    setRoles(data.roles);
    setOwnerId(data.ownerId);
    setTotal(Number(data.total ?? data.members.length));
    setCursor(data.nextCursor ?? null);
    setSelectedId(data.members[0]?.userId ?? null);
    setDraftRoles(data.members[0]?.roleIds.filter((id: string) => data.roles.some((role: Role) => role.id === id && !role.isManaged)) ?? []);
  }).catch((reason) => setError(reason.message ?? "Не удалось загрузить участников.")).finally(() => setLoading(false)); }, [spaceId]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/v1/spaces/${spaceId}/members?limit=100&cursor=${encodeURIComponent(cursor)}`);
      const data = await response.json();
      if (!response.ok) return setError(data.message ?? "Не удалось загрузить следующую страницу.");
      setItems((current) => {
        const known = new Set(current.map((member) => member.userId));
        return [...current, ...(data.members as Member[]).filter((member) => !known.has(member.userId))];
      });
      setTotal(Number(data.total ?? total));
      setCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  function selectMember(member: Member) { setSelectedId(member.userId); setDraftRoles(member.roleIds.filter((id) => customRoles.some((role) => role.id === id))); setError(""); }
  function toggleRole(roleId: string) { setDraftRoles((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]); }

  async function saveRoles() {
    if (!selected) return; setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/members`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: selected.userId, roleIds: draftRoles }) });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить роли.");
    setItems((current) => current.map((member) => member.userId === selected.userId ? { ...member, roleIds: data.roleIds } : member));
  }

  async function removeMember() {
    if (!selected || !window.confirm(`Исключить ${selected.displayName} из пространства?`)) return;
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/members?userId=${encodeURIComponent(selected.userId)}`, { method: "DELETE" });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось исключить участника.");
    const next = items.filter((member) => member.userId !== selected.userId); setItems(next); setTotal((value) => Math.max(0, value - 1)); setSelectedId(next[0]?.userId ?? null); setDraftRoles(next[0]?.roleIds.filter((id) => customRoles.some((role) => role.id === id)) ?? []);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog member-dialog" role="dialog" aria-modal="true" aria-labelledby="members-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Users size={22} /></div><h2 id="members-title">Участники — {total || items.length}</h2><p>Назначайте роли и управляйте доступом к пространству.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем участников...</div> : <div className="member-manager-layout"><aside className="managed-member-list">{items.map((member) => <button key={member.userId} className={member.userId === selectedId ? "active" : ""} onClick={() => selectMember(member)}><i>{member.avatarUrl ? <MediaImage src={member.avatarUrl} /> : member.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</i><span><strong>{member.displayName}{member.superupSupporter ? " 💎" : ""}</strong><small>@{member.username} · уровень {member.level}</small></span>{member.userId === ownerId ? <b>Владелец</b> : null}</button>)}{cursor ? <button className="managed-members-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? <><LoaderCircle className="spin" size={14} /> Загружаем…</> : "Загрузить ещё"}</button> : null}</aside><div className="member-role-editor">{selected ? <><div className="member-editor-head"><div><strong>{selected.displayName}</strong><span>В сообществе с {new Date(selected.joinedAt).toLocaleDateString("ru-RU")}</span></div></div><h3>Пользовательские роли</h3>{selected.userId === ownerId ? <div className="role-protected"><Users size={30} /><strong>Владелец пространства</strong><span>Его роли и доступ защищены.</span></div> : <><div className="member-role-grid">{customRoles.length ? customRoles.map((role) => <label key={role.id}><input type="checkbox" checked={draftRoles.includes(role.id)} onChange={() => toggleRole(role.id)} /><i style={{ background: role.color }} /><span>{role.name}</span></label>) : <p>Сначала создайте пользовательскую роль.</p>}</div><div className="role-actions"><button className="danger-button" onClick={removeMember} disabled={working}><UserMinus size={15} /> Исключить</button><button className="auth-submit" onClick={saveRoles} disabled={working}><Save size={15} /> Сохранить роли</button></div></>}</> : <div className="role-protected"><Users size={30} /><strong>Участников пока нет</strong></div>}</div></div>}</section></div>;
}
