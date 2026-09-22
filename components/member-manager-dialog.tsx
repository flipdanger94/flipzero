"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Save, UserMinus, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";

type Role = { id: string; name: string; color: string; position: number; permissions: number; isManaged: boolean; assignable?: boolean };
type Member = { userId: string; username: string; displayName: string; nickname: string | null; level: number; joinedAt: string; avatarUrl?: string | null; roleIds: string[]; canEditRoles?: boolean; canKick?: boolean };
type JoinRequest = { id: string; userId: string; username: string; displayName: string; avatarUrl?: string | null; message: string | null; createdAt: string };

export function MemberManagerDialog({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [items, setItems] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const selected = useMemo(() => items.find((member) => member.userId === selectedId) ?? null, [items, selectedId]);
  const customRoles = roles.filter((role) => !role.isManaged);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/v1/spaces/${spaceId}/members`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })),
      fetch(`/api/v1/spaces/${spaceId}/join-requests`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })),
    ]).then(([memberResult, requestResult]) => {
      if (!memberResult.response.ok) throw new Error(memberResult.data.message);
      const data = memberResult.data;
      setItems(data.members); setRoles(data.roles); setOwnerId(data.ownerId); setSelectedId(data.members[0]?.userId ?? null);
      setDraftRoles(data.members[0]?.roleIds.filter((id: string) => data.roles.some((role: Role) => role.id === id && !role.isManaged)) ?? []);
      if (requestResult.response.ok) setJoinRequests(requestResult.data.requests ?? []);
    }).catch((reason) => {
      if (reason?.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить участников.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [spaceId]);

  function selectMember(member: Member) { setSelectedId(member.userId); setDraftRoles(member.roleIds.filter((id) => customRoles.some((role) => role.id === id))); setError(""); }
  function toggleRole(roleId: string) { setDraftRoles((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]); }

  async function saveRoles() {
    if (!selected) return; setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/members`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: selected.userId, roleIds: draftRoles }) });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось сохранить роли.");
    setItems((current) => current.map((member) => member.userId === selected.userId ? { ...member, roleIds: data.roleIds } : member));
  }

  async function reviewJoinRequest(requestId: string, status: "approved" | "rejected") {
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/join-requests`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, status }),
    });
    const data = await response.json().catch(() => null);
    setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось рассмотреть заявку.");
    setJoinRequests((current) => current.filter((item) => item.id !== requestId));
    if (status === "approved") {
      const memberResponse = await fetch(`/api/v1/spaces/${spaceId}/members`);
      const memberData = await memberResponse.json().catch(() => null);
      if (memberResponse.ok) setItems(memberData.members ?? []);
    }
  }

  async function removeMember() {
    if (!selected || !window.confirm(`Исключить ${selected.displayName} из пространства?`)) return;
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/members?userId=${encodeURIComponent(selected.userId)}`, { method: "DELETE" });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось исключить участника.");
    const next = items.filter((member) => member.userId !== selected.userId); setItems(next); setSelectedId(next[0]?.userId ?? null); setDraftRoles(next[0]?.roleIds.filter((id) => customRoles.some((role) => role.id === id)) ?? []);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog member-dialog" role="dialog" aria-modal="true" aria-labelledby="members-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Users size={22} /></div><h2 id="members-title">Участники</h2><p>Назначайте роли и управляйте доступом к пространству.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{joinRequests.length ? <section className="join-request-panel"><h3>Заявки на вступление <b>{joinRequests.length}</b></h3>{joinRequests.map((request) => <article key={request.id}><i>{request.avatarUrl ? <MediaImage src={request.avatarUrl} /> : request.displayName.slice(0, 2).toUpperCase()}</i><span><strong>{request.displayName}</strong><small>@{request.username} · {new Date(request.createdAt).toLocaleDateString("ru-RU")}</small>{request.message ? <p>{request.message}</p> : null}</span><button className="approve" onClick={() => void reviewJoinRequest(request.id, "approved")} disabled={working}><Check size={15} /> Принять</button><button className="reject" onClick={() => void reviewJoinRequest(request.id, "rejected")} disabled={working}><X size={15} /> Отклонить</button></article>)}</section> : null}{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем участников...</div> : <div className="member-manager-layout"><aside className="managed-member-list">{items.map((member) => <button key={member.userId} className={member.userId === selectedId ? "active" : ""} onClick={() => selectMember(member)}><i>{member.avatarUrl ? <MediaImage src={member.avatarUrl} /> : member.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</i><span><strong>{member.displayName}</strong><small>@{member.username} · уровень {member.level}</small></span>{member.userId === ownerId ? <b>Владелец</b> : null}</button>)}</aside><div className="member-role-editor">{selected ? <><div className="member-editor-head"><div><strong>{selected.displayName}</strong><span>В сообществе с {new Date(selected.joinedAt).toLocaleDateString("ru-RU")}</span></div></div><h3>Пользовательские роли</h3>{selected.userId === ownerId ? <div className="role-protected"><Users size={30} /><strong>Владелец пространства</strong><span>Его роли и доступ защищены.</span></div> : <><div className="member-role-grid">{customRoles.length ? customRoles.map((role) => { const checked = draftRoles.includes(role.id); const disabled = !selected.canEditRoles || (!role.assignable && !checked); return <label key={role.id} className={disabled ? "is-disabled" : ""}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleRole(role.id)} /><i style={{ background: role.color }} /><span>{role.name}</span></label>; }) : <p>Сначала создайте пользовательскую роль.</p>}</div><div className="role-actions">{selected.canKick ? <button className="danger-button" onClick={removeMember} disabled={working}><UserMinus size={15} /> Исключить</button> : null}{selected.canEditRoles ? <button className="auth-submit" onClick={saveRoles} disabled={working}><Save size={15} /> Сохранить роли</button> : null}</div>{!selected.canEditRoles && !selected.canKick ? <div className="role-protected"><Users size={26} /><strong>Недостаточно прав</strong><span>Ваша роль не позволяет управлять этим участником.</span></div> : null}</>}</> : <div className="role-protected"><Users size={30} /><strong>Участников пока нет</strong></div>}</div></div>}</section></div>;
}
