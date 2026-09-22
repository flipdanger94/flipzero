"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Bell, BookOpen, CalendarDays, ChevronRight, ClipboardList, Copy, FolderPlus, Gavel, Hash, Image as ImageIcon, Link2, LogOut, Settings2, ShieldCheck, Trash2, Trophy, Users } from "lucide-react";

type Props = { spaceId: string; name: string; canManageServer: boolean; canManageChannels: boolean; canManageRoles: boolean; canManageMembers: boolean; canModerate: boolean; canInvite: boolean; isOwner: boolean; onClose: () => void; onSettings: () => void; onRoles: () => void; onInvite: () => void; onCommunityLink: () => void; onProgress: () => void; onEvents: () => void; onWiki: () => void; onMembers: () => void; onModeration: () => void; onAudit: () => void; onSystem: () => void; onCreateChannel: () => void; onCreateCategory: () => void; onAppearance: () => void; onLeave: () => void; onDelete: () => void };

export function ServerContextMenu(props: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationMode, setNotificationMode] = useState<"all" | "mentions" | "off">("mentions");
  const [notificationSaving, setNotificationSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${props.spaceId}/notifications`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok && ["all", "mentions", "off"].includes(data.mode)) setNotificationMode(data.mode);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [props.spaceId]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault(); const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement)); const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length; items[next]?.focus();
    };
    window.addEventListener("keydown", keydown); menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => window.removeEventListener("keydown", keydown);
  }, [props]);
  async function changeNotificationMode(mode: "all" | "mentions" | "off") {
    if (notificationSaving || mode === notificationMode) return;
    const previous = notificationMode;
    setNotificationMode(mode);
    setNotificationSaving(true);
    const response = await fetch(`/api/v1/spaces/${props.spaceId}/notifications`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => null);
    setNotificationSaving(false);
    if (!response?.ok) setNotificationMode(previous);
  }

  const item = (label: string, icon: React.ReactNode, action: () => void, danger = false) => <button role="menuitem" className={danger ? "danger" : ""} onClick={() => { action(); props.onClose(); }}>{icon}<span>{label}</span></button>;
  return <><button className="server-menu-overlay" aria-label="Закрыть меню" onClick={props.onClose} /><div ref={menuRef} className="server-context-menu" role="menu" aria-label={`Меню ${props.name}`}>
    {props.canManageServer ? item("Настройки сервера", <Settings2 size={17} />, props.onSettings) : null}
    {props.canManageRoles ? item("Роли и права", <ShieldCheck size={17} />, props.onRoles) : null}
    {props.canInvite ? item("Пригласить участников", <Link2 size={17} />, props.onInvite) : null}
    {item("Ссылка сообщества", <Copy size={17} />, props.onCommunityLink)}
    {item("Прогресс и награды", <Trophy size={17} />, props.onProgress)}
    {item("События сообщества", <CalendarDays size={17} />, props.onEvents)}
    {item("База знаний", <BookOpen size={17} />, props.onWiki)}
    {props.canManageMembers ? item("Управление участниками", <Users size={17} />, props.onMembers) : null}
    {props.canModerate ? item("Модерация", <Gavel size={17} />, props.onModeration) : null}
    {props.canManageServer ? item("Журнал действий", <ClipboardList size={17} />, props.onAudit) : null}
    {item("Состояние системы", <Activity size={17} />, props.onSystem)}
    <button role="menuitem" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}><Bell size={17} /><span>Уведомления сервера</span><ChevronRight className={notificationsOpen ? "rotated" : ""} size={15} /></button>
    {notificationsOpen ? <div className="server-notification-submenu" role="group" aria-label="Режим уведомлений">{([["all", "Все"], ["mentions", "Только упоминания"], ["off", "Отключить"]] as const).map(([value, label]) => <button role="menuitem" disabled={notificationSaving} className={notificationMode === value ? "selected" : ""} key={value} onClick={() => void changeNotificationMode(value)}>{label}</button>)}</div> : null}
    {props.canManageChannels ? item("Создать канал", <Hash size={17} />, props.onCreateChannel) : null}
    {props.canManageChannels ? item("Создать категорию", <FolderPlus size={17} />, props.onCreateCategory) : null}
    {props.canManageServer ? item("Изменить баннер/иконку", <ImageIcon size={17} />, props.onAppearance) : null}
    <div className="server-menu-divider" />
    {!props.isOwner ? item("Выйти из сообщества", <LogOut size={17} />, props.onLeave, true) : null}
    {props.isOwner ? item("Удалить сервер", <Trash2 size={17} />, props.onDelete, true) : null}
  </div></>;
}
