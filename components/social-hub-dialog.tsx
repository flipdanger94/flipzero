"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Award, Crown, FileText, Gamepad2, ImageIcon, Link2, LoaderCircle, MapPin, MessageCircle, Mic2, Search, SendHorizontal, ShieldCheck, Sparkles, Star, UserPlus, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";

type Person = { id: string; username: string; displayName: string; avatarUrl?: string | null; presence?: string };
type ProfileDetails = { bio:string|null; profileLocation:string|null; profileStatus:string|null; globalLevel:number; stats:{messages:number;friends:number;servers:number}; servers:Array<{id:string;name:string;iconUrl:string|null}> };
type FriendRequest = { id: string; from: Person };
type Conversation = { id: string; other: Person; unread: number; lastMessage: { text: string; createdAt: string } | null };
type DirectMessage = { id: string; senderId: string; receiverId: string; text: string; createdAt: string };

export function SocialHubDialog({ currentUserId, initialTab = "messages", initialUserId, onClose, embedded = false, isAdmin = false, onOpenAdmin }: { currentUserId: string; initialTab?: "messages" | "friends" | "superflip"; initialUserId?: string | null; onClose?: () => void; embedded?: boolean; isAdmin?: boolean; onOpenAdmin?: () => void }) {
  const [tab, setTab] = useState(initialTab); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState("");
  const [friends, setFriends] = useState<Person[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [results, setResults] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]); const [active, setActive] = useState<Conversation | null>(null); const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [sending, setSending] = useState(false);
  const directMessagesRef = useRef<HTMLDivElement | null>(null); const followLatestRef = useRef(true);
  const [superflip, setSuperflip] = useState<{ status: "not_launched" | "trial_active" | "active" | "expired"; active: boolean; waitlisted: boolean; expiresAt?: string | null; capabilities?: { directMessageLimit: number; profileBioLimit: number; avatarUploadMb: number; bannerUploadMb: number; animatedProfileMedia: boolean } } | null>(null);

  const loadFriends = useCallback(async () => { const response = await fetch("/api/friends"); const data = await response.json(); if (response.ok) { setFriends(data.friends ?? []); setRequests(data.requests ?? []); } }, []);
  const loadConversations = useCallback(async () => { const response = await fetch("/api/messages"); const data = await response.json(); if (response.ok) setConversations(data.conversations ?? []); }, []);
  const loadMessages = useCallback(async (conversation: Conversation) => { const response = await fetch(`/api/messages?conversationId=${conversation.id}`); const data = await response.json(); if (response.ok) setMessages(data.messages ?? []); }, []);
  useEffect(() => { void (async () => { await Promise.all([loadFriends(), loadConversations(), fetch("/api/superflip/status").then((r) => r.json()).then(setSuperflip)]); setLoading(false); })(); }, [loadConversations, loadFriends]);
  useEffect(() => { if (!initialUserId || loading) return; const existing=conversations.find(item=>item.other.id===initialUserId); if(existing){setActive(existing);setTab("messages");return} fetch(`/api/v1/users/${initialUserId}/profile`).then(r=>r.json()).then(d=>{if(d.profile){setActive({id:"",other:{id:d.profile.id,username:d.profile.username,displayName:d.profile.displayName,avatarUrl:d.profile.avatarUrl,presence:d.profile.presence},unread:0,lastMessage:null});setTab("messages")}}); }, [initialUserId, loading, conversations]);
  useEffect(() => { if (!active) return; const selected = active; void (async () => { await loadMessages(selected); })(); const timer = window.setInterval(() => { void loadMessages(selected); }, 4000); return () => window.clearInterval(timer); }, [active, loadMessages]);
  useEffect(() => { const list = directMessagesRef.current; if (list && followLatestRef.current) list.scrollTop = list.scrollHeight; }, [messages]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void loadConversations(); };
    const timer = window.setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [loadConversations]);

  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const query = String(new FormData(event.currentTarget).get("q") ?? ""); const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`); const data = await response.json(); setResults(data.users ?? []); }
  async function requestFriend(toId: string) { const response = await fetch("/api/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toId }) }); const data = await response.json(); setNotice(response.ok ? "Заявка отправлена." : data.message); await loadFriends(); }
  async function respond(requestId: string, status: "accepted" | "declined") { await fetch("/api/friends", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId, status }) }); await loadFriends(); await loadConversations(); }
  async function removeFriend(friendId: string) { await fetch(`/api/friends?friendId=${friendId}`, { method: "DELETE" }); await loadFriends(); }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active?.other || sending) return;
    const form = event.currentTarget; const text = String(new FormData(form).get("text") ?? "").trim(); if (!text) return;
    setSending(true); setNotice("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receiverId: active.other.id, text }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setNotice(data?.message ?? "Не удалось отправить сообщение."); return; }
      form.reset(); followLatestRef.current = true;
      setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message]);
      await loadConversations();
    } catch { setNotice("Нет соединения. Сообщение не отправлено."); }
    finally { setSending(false); }
  }
  async function openChat(person: Person) { const conversation = conversations.find((item) => item.other.id === person.id); followLatestRef.current = true; setMessages([]); setNotice(""); setActive(conversation ?? { id: "", other: person, unread: 0, lastMessage: null }); setTab("messages"); }
  async function joinWaitlist() { const response = await fetch("/api/superflip/purchase", { method: "POST" }); const data = await response.json(); setNotice(data.message); setSuperflip((value) => value ? { ...value, waitlisted: true } : value); }
  async function inviteFriend() { const url = `${window.location.origin}/register`; if (navigator.share) { try { await navigator.share({ title: "FlipZero", text: "Присоединяйся ко мне в FlipZero", url }); return; } catch {} } await navigator.clipboard.writeText(url); setNotice("Ссылка-приглашение скопирована."); }

  const content = <section className={`social-hub ${embedded ? "social-hub-embedded" : ""}`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true}><header><div><small>FLIPZERO SOCIAL</small><h2>{tab === "messages" ? "Сообщения" : tab === "friends" ? "Друзья" : "SuperFlip"}</h2></div>{onClose ? <button onClick={onClose} aria-label="Закрыть"><X size={19} /></button> : null}</header><nav><button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}><MessageCircle size={16} /> Сообщения</button><button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}><Users size={16} /> Друзья {requests.length ? <b>{requests.length}</b> : null}</button><button className={tab === "superflip" ? "active premium" : "premium"} onClick={() => setTab("superflip")}><Crown size={16} /> SuperFlip</button>{isAdmin && onOpenAdmin ? <button className="platform-admin-button" onClick={onOpenAdmin}><ShieldCheck size={16} /> Админ-панель</button> : null}</nav>
    {loading ? <div className="social-loading"><LoaderCircle className="spin" /> Загрузка…</div> : tab === "messages" ? <div className={`direct-layout ${active ? "has-profile" : ""}`}><aside>{conversations.length ? conversations.map((item) => <button key={item.id} className={active?.id === item.id ? "active" : ""} onClick={() => { setMessages([]); setNotice(""); followLatestRef.current = true; setActive(item); }}><Avatar person={item.other} /><span><strong>{item.other.displayName}</strong><small>{item.lastMessage?.text ?? "Новый диалог"}</small></span>{item.unread ? <b>{item.unread}</b> : null}</button>) : <div className="social-list-empty"><span>Диалогов пока нет.</span><button onClick={() => setTab("friends")}>Написать другу</button></div>}</aside><section>{active ? <><div className="direct-title"><Avatar person={active.other} /><strong>{active.other.displayName}</strong><span>@{active.other.username}</span></div><div className="direct-messages" ref={directMessagesRef} onScroll={(event) => { const list = event.currentTarget; followLatestRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 96; }}>{messages.map((message) => <article key={message.id} className={message.senderId === currentUserId ? "mine" : ""}><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></article>)}</div><form className="direct-composer" onSubmit={sendMessage}><input name="text" maxLength={superflip?.capabilities?.directMessageLimit ?? 4000} placeholder={`Написать сообщение…${superflip?.active ? " · SuperFlip до 8000 символов" : ""}`} required /><button disabled={sending} aria-label="Отправить сообщение"><SendHorizontal size={17} /></button></form>{notice ? <p className="direct-notice" role="alert">{notice}</p> : null}</> : <div className="social-empty"><MessageCircle size={32} /><strong>{conversations.length ? "Выберите диалог" : "Начните новый диалог"}</strong><span>{conversations.length ? "Сообщения появятся здесь." : "Откройте список друзей и выберите собеседника."}</span><button onClick={() => setTab("friends")}>Перейти к друзьям</button></div>}</section>{active ? <DirectProfile person={active.other} onOpenFriends={() => setTab("friends")} /> : null}</div> : tab === "friends" ? <div className="friends-content"><form className="friend-search" onSubmit={search}><Search size={16} /><input name="q" minLength={2} placeholder="Поиск по username" /><button>Найти</button></form>{notice ? <p className="social-notice">{notice}</p> : null}{requests.length ? <section><h3>Новые заявки</h3>{requests.map((item) => <div className="person-row" key={item.id}><Avatar person={item.from} /><span><strong>{item.from.displayName}</strong><small>@{item.from.username}</small></span><button onClick={() => respond(item.id, "accepted")}>Принять</button><button className="muted" onClick={() => respond(item.id, "declined")}>Отклонить</button></div>)}</section> : null}{results.length ? <section><h3>Результаты поиска</h3>{results.map((person) => <div className="person-row" key={person.id}><Avatar person={person} /><span><strong>{person.displayName}</strong><small>@{person.username}</small></span><button onClick={() => requestFriend(person.id)}><UserPlus size={14} /> Добавить</button></div>)}</section> : null}<section><h3>Мои друзья</h3>{friends.map((person) => <div className="person-row" key={person.id}><Avatar person={person} /><span><strong>{person.displayName}</strong><small>@{person.username}</small></span><button onClick={() => openChat(person)}>Написать</button><button className="muted" onClick={() => removeFriend(person.id)}>Удалить</button></div>)}{!friends.length ? <div className="social-list-empty"><span>Пока нет друзей. Найдите пользователя выше или пригласите знакомого.</span><button onClick={() => void inviteFriend()}>Пригласить друга</button></div> : null}</section></div> : <div className="superflip-panel"><span className="superflip-icon"><Crown size={34} /></span><small>{superflip?.status === "active" ? "SUPERFLIP АКТИВЕН" : superflip?.status === "trial_active" ? "ПОДАРОЧНЫЙ SUPERFLIP" : superflip?.status === "expired" ? "SUPERFLIP ЗАВЕРШЁН" : "SUPERFLIP: СКОРО"}</small><h3>{superflip?.active ? "Ваши расширенные возможности включены" : "Больше возможностей. Больше вашего стиля."}</h3><p>{superflip?.active ? `Личные сообщения до ${superflip.capabilities?.directMessageLimit ?? 8000} символов, профиль до ${superflip.capabilities?.profileBioLimit ?? 500} символов и большие медиафайлы.` : <>Премиум-профиль, расширенные загрузки и дополнительные функции сообщества за <strong>$4.99 в месяц</strong>.</>}</p><div className="premium-features"><span>Профиль до {superflip?.capabilities?.profileBioLimit ?? 190} символов</span><span>Аватар до {superflip?.capabilities?.avatarUploadMb ?? 2} МБ</span><span>Баннер до {superflip?.capabilities?.bannerUploadMb ?? 4} МБ</span></div>{superflip?.active ? <button disabled>SuperFlip активен{superflip.expiresAt ? ` до ${new Date(superflip.expiresAt).toLocaleDateString("ru-RU")}` : ""}</button> : <button onClick={joinWaitlist} disabled={superflip?.waitlisted}>{superflip?.waitlisted ? "Вы в листе ожидания" : "Сообщить о запуске"}</button>}{notice ? <p className="social-notice">{notice}</p> : null}</div>}</section>;
  return embedded ? content : <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>{content}</div>;
}

function Avatar({ person }: { person: Person }) { return <i className="social-avatar">{person.avatarUrl ? <MediaImage src={person.avatarUrl} /> : person.displayName.slice(0, 2).toUpperCase()}</i>; }

function DirectProfile({ person, onOpenFriends }: { person: Person; onOpenFriends: () => void }) {
  const [details,setDetails]=useState<ProfileDetails|null>(null);
  useEffect(()=>{let cancelled=false;void fetch(`/api/v1/users/${person.id}/profile`,{cache:"no-store"}).then(async r=>r.ok?r.json():null).then(data=>{if(!cancelled)setDetails(data?.profile??null)});return()=>{cancelled=true}},[person.id]);
  const isOnline = person.presence === "online";
  return <aside className="direct-profile profile-reference" aria-label={`Профиль ${person.displayName}`}>
    <div className="direct-profile-cover"><span>FLIPZERO</span></div>
    <div className="direct-profile-identity">
      <Avatar person={person} />
      <span className={`direct-presence ${isOnline ? "online" : ""}`} />
      <h3>{person.displayName}</h3>
      <p>@{person.username}</p>
      <small>{isOnline ? "● В сети" : "Не в сети"}</small>
      <div className="profile-reference-actions"><button><MessageCircle size={15}/> Сообщение</button><button onClick={onOpenFriends}><Users size={15}/> Друзья</button></div>
    </div>
    <div className="profile-reference-tabs"><b>Профиль</b><span>Общие серверы</span></div>
    <section className="profile-reference-about">
      <h4>О пользователе</h4>
      <p>{details?.bio || "Пользователь пока ничего о себе не рассказал."}</p>
      {details?.profileStatus ? <span>{details.profileStatus}</span> : null}
      {details?.profileLocation ? <span><MapPin size={15}/>{details.profileLocation}</span> : null}
    </section>
    {details ? <section className="profile-reference-stats"><h4>Статистика</h4><div><span><Star size={16}/><b>{details.globalLevel}</b><small>Уровень</small></span><span><MessageCircle size={16}/><b>{details.stats.messages}</b><small>Сообщений</small></span><span><Users size={16}/><b>{details.stats.friends}</b><small>Друзей</small></span></div></section> : null}
    {details?.servers.length ? <section><h4>Серверы</h4>{details.servers.map(server=><span key={server.id}><ShieldCheck size={16}/>{server.name}</span>)}</section> : null}
  </aside>;
}
