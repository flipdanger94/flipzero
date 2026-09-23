"use client";

import { useEffect, useRef } from "react";
import { BookOpen, CalendarDays, Copy, FolderPlus, Gavel, Hash, Link2, LogOut, Settings2, ShieldCheck, Trash2, Trophy, Users } from "lucide-react";

type Props = { name: string; canManage: boolean; isOwner: boolean; onClose: () => void; onSettings: () => void; onRoles: () => void; onInvite: () => void; onCommunityLink: () => void; onCopyId: () => void; onProgress: () => void; onEvents: () => void; onWiki: () => void; onMembers: () => void; onModeration: () => void; onCreateChannel: () => void; onCreateCategory: () => void; onLeave: () => void; onDelete: () => void };

export function ServerContextMenu(props: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    window.addEventListener("keydown", keydown);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => window.removeEventListener("keydown", keydown);
  }, [props]);
  const item = (label: string, icon: React.ReactNode, action: () => void, danger = false) => <button role="menuitem" className={danger ? "danger" : ""} onClick={() => { action(); props.onClose(); }}>{icon}<span>{label}</span></button>;
  return <><button className="server-menu-overlay" aria-label="Закрыть меню" onClick={props.onClose} /><div ref={menuRef} className="server-context-menu" role="menu" aria-label={`Меню ${props.name}`}>
    <small className="server-menu-group">ПРОСТРАНСТВО</small>
    {item("Пригласить в пространство", <Link2 size={17} />, props.onInvite)}
    {props.canManage ? item("Настройки пространства", <Settings2 size={17} />, props.onSettings) : null}
    {item("Ссылка сообщества", <Copy size={17} />, props.onCommunityLink)}
    {props.canManage ? <><div className="server-menu-divider" /><small className="server-menu-group">УПРАВЛЕНИЕ</small>
      {item("Участники", <Users size={17} />, props.onMembers)}
      {item("Роли и права", <ShieldCheck size={17} />, props.onRoles)}
      {item("Модерация и журнал", <Gavel size={17} />, props.onModeration)}
      {item("Создать канал", <Hash size={17} />, props.onCreateChannel)}
      {item("Создать категорию", <FolderPlus size={17} />, props.onCreateCategory)}</> : null}
    <div className="server-menu-divider" /><small className="server-menu-group">СООБЩЕСТВО</small>
    {item("Прогресс и награды", <Trophy size={17} />, props.onProgress)}
    {item("События сообщества", <CalendarDays size={17} />, props.onEvents)}
    {item("База знаний", <BookOpen size={17} />, props.onWiki)}
    <div className="server-menu-divider" />
    {item("Копировать ID пространства", <Copy size={17} />, props.onCopyId)}
    {!props.isOwner ? item("Выйти из пространства", <LogOut size={17} />, props.onLeave, true) : null}
    {props.isOwner ? item("Удалить пространство", <Trash2 size={17} />, props.onDelete, true) : null}
  </div></>;
}
