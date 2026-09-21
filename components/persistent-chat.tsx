"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Award, CirclePlus, CornerUpLeft, ExternalLink, Gamepad2, Link2, LoaderCircle, MapPin, MessageCircle, MessageSquareText, Mic, Pin, Search, SendHorizontal, ShieldCheck, Smile, Sparkles, Square, Star, Trash2, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";

type Attachment = { type: "voice"; url: string; duration: number; mimeType: string };
type ChatMessage = { id: string; authorId: string; displayName: string; username: string; avatarUrl?: string | null; content: string; attachments?: Attachment[]; replyToId: string | null; editedAt?: string | null; pinnedAt?: string | null; createdAt: string; reactions: Array<{ emoji: string; userId: string }> };

function LinkPreview({ content }: { content: string }) {
  const match = content.match(/https?:\/\/[^\s<]+/i);
  if (!match) return null;
  let url: URL;
  try { url = new URL(match[0]); } catch { return null; }
  return <a className="link-unfurl" href={url.href} target="_blank" rel="noreferrer"><span>{url.hostname.replace(/^www\./, "")}</span><strong>{url.pathname === "/" ? "Открыть ссылку" : url.pathname.replace(/\/$/, "")}</strong><small>{url.href}</small><ExternalLink size={15} /></a>;
}

export function PersistentChat({ channelId, channelName, spaceId, currentUserId, ownerId, searchQuery }: { channelId: string; channelName: string; spaceId: string; currentUserId: string; ownerId?: string; searchQuery: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [profile, setProfile] = useState<ChatMessage | null>(null); const [draft, setDraft] = useState(""); const [reply, setReply] = useState<ChatMessage | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [recording, setRecording] = useState(false); const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null); const streamRef = useRef<MediaStream | null>(null); const chunksRef = useRef<Blob[]>([]); const startedRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement | null>(null); const followLatestRef = useRef(true); const mutationRef = useRef(false); const revisionRef = useRef(0);
  async function load(query = searchQuery) { const response = await fetch(`/api/v1/channels/${channelId}/messages${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); const data = await response.json(); if (response.ok) setMessages(data.messages ?? []); else setError(data.message ?? "Не удалось загрузить сообщения."); setLoading(false); }
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight || mutationRef.current || document.visibilityState === "hidden") return;
      inFlight = true;
      const revision = revisionRef.current;
      try {
        const query = searchQuery.trim();
        const response = await fetch(`/api/v1/channels/${channelId}/messages${query ? `?q=${encodeURIComponent(query)}` : ""}`, { signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted || mutationRef.current || revision !== revisionRef.current) return;
        if (response.ok) { setMessages(data.messages ?? []); setError(""); }
        else setError(data.message ?? "Не удалось загрузить сообщения.");
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) { setError("Не удалось загрузить сообщения. Повторяем попытку…"); setLoading(false); }
      } finally { inFlight = false; }
    }
    const first = window.setTimeout(() => void refresh(), 180);
    const interval = window.setInterval(() => void refresh(), 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearTimeout(first); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [channelId, searchQuery]);
  useEffect(() => { const list = messageListRef.current; if (list && followLatestRef.current) list.scrollTop = list.scrollHeight; }, [messages]);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => { const seconds = Math.floor((Date.now() - startedRef.current) / 1000); setRecordSeconds(seconds); if (seconds >= 60 && recorderRef.current?.state === "recording") recorderRef.current.stop(); }, 250); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  async function post(content: string, attachments: Attachment[] = []) { mutationRef.current = true; revisionRef.current++; try { const response = await fetch(`/api/v1/channels/${channelId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, attachments, replyToId: reply?.id }) }); const data = await response.json(); if (!response.ok) { setError(data.message ?? "Не удалось отправить сообщение."); return; } followLatestRef.current = true; setMessages((items) => [...items, data.message]); setDraft(""); setReply(null); void fetch("/api/v1/gamification/award", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "message", spaceId, idempotencyKey: `message:${data.message.id}` }) }); } catch { setError("Не удалось отправить сообщение. Проверьте соединение."); } finally { mutationRef.current = false; } }
  async function send(event: FormEvent) { event.preventDefault(); const content = draft.trim(); if (content) await post(content); }
  async function startRecording() { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); streamRef.current = stream; recorderRef.current = recorder; chunksRef.current = []; startedRef.current = Date.now(); setRecordSeconds(0); recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); }; recorder.onstop = () => { const duration = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000)); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === "string") void post("Голосовое сообщение", [{ type: "voice", url: reader.result, duration, mimeType: blob.type }]); }; reader.readAsDataURL(blob); stream.getTracks().forEach((track) => track.stop()); setRecording(false); }; recorder.start(); setRecording(true); } catch { setError("Не удалось получить доступ к микрофону."); } }
  function stopRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }
  async function react(messageId: string, emoji: string) { await fetch(`/api/v1/channels/${channelId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "react", messageId, emoji }) }); await load(); }
  async function pin(messageId: string) { await fetch(`/api/v1/channels/${channelId}/messages`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "pin", messageId }) }); await load(); }
  async function remove(messageId: string) { await fetch(`/api/v1/channels/${channelId}/messages?messageId=${messageId}`, { method: "DELETE" }); setMessages((items) => items.filter((item) => item.id !== messageId)); }
  return <>{profile ? <ProfileModal message={profile} onClose={() => setProfile(null)} /> : null}<div className="message-list" ref={messageListRef} onScroll={(event) => { const list = event.currentTarget; followLatestRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 96; }}><div className="channel-intro"><div className="intro-icon"><MessageSquareText size={31} /></div><h1>#{channelName}</h1><p>Сообщения сохраняются и доступны всем участникам пространства.</p></div>{loading ? <div className="chat-loading"><LoaderCircle className="spin" /> Загружаем сообщения...</div> : messages.length ? messages.map((message) => <article className="message persistent-message" key={message.id}><div className="avatar avatar-coral">{message.avatarUrl ? <MediaImage src={message.avatarUrl} /> : message.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</div><div className="message-body"><div className="message-meta"><button type="button" className="profile-name-trigger" onClick={() => setProfile(message)}>{message.displayName}</button><time>{new Date(message.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>{message.editedAt ? <small>изменено</small> : null}{message.pinnedAt ? <Pin size={12} /> : null}</div>{message.replyToId ? <small className="reply-mark"><CornerUpLeft size={11} /> Ответ на сообщение</small> : null}<p>{message.content}</p>{message.attachments?.filter((item) => item.type === "voice").map((item, index) => <div className="voice-message" key={index}><Mic size={16} /><audio controls preload="metadata" src={item.url} /><span>{item.duration} сек.</span></div>)}<LinkPreview content={message.content} /><div className="reactions">{[...new Set(message.reactions.map((item) => item.emoji))].map((emoji) => <button key={emoji} onClick={() => react(message.id, emoji)}>{emoji} {message.reactions.filter((item) => item.emoji === emoji).length}</button>)}<button onClick={() => react(message.id, "🔥")}>🔥</button></div></div><div className="message-actions"><button title="Ответить" onClick={() => setReply(message)}><CornerUpLeft size={14} /></button>{ownerId === currentUserId ? <button title="Закрепить" onClick={() => pin(message.id)}><Pin size={14} /></button> : null}{message.authorId === currentUserId || ownerId === currentUserId ? <button title="Удалить" onClick={() => remove(message.id)}><Trash2 size={14} /></button> : null}</div></article>) : <div className="search-empty"><Search size={24} /><strong>{searchQuery ? "Ничего не найдено" : "Начните разговор"}</strong><span>{searchQuery ? "Попробуйте другой запрос." : "Первое сообщение появится здесь."}</span></div>}{error ? <div className="auth-error">{error}</div> : null}</div><div className="composer-wrap">{reply ? <div className="replying"><span>Ответ для <b>{reply.displayName}</b></span><button onClick={() => setReply(null)}>×</button></div> : null}<form className={`composer ${recording ? "is-recording" : ""}`} onSubmit={send}><button type="button"><CirclePlus size={22} /></button><textarea placeholder={`Написать в #${channelName}`} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />{recording ? <span className="recording-time"><i /> Запись {recordSeconds} сек.</span> : null}<button type="button" title={recording ? "Остановить и отправить" : "Записать голосовое сообщение"} onClick={recording ? stopRecording : startRecording}>{recording ? <Square size={18} /> : <Mic size={20} />}</button><button type="button"><Smile size={20} /></button><button className="send-button" disabled={!draft.trim()}><SendHorizontal size={18} /></button></form></div></>;
}


function ProfileModal({ message, onClose }: { message: ChatMessage; onClose: () => void }) {
  return <div className="fz-profile-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="fz-profile-modal" role="dialog" aria-modal="true" aria-label={`Профиль ${message.displayName}`}>
      <button className="fz-profile-close" onClick={onClose}><X size={20}/></button>
      <header className="fz-profile-hero">
        <div className="fz-profile-avatar">{message.avatarUrl?<MediaImage src={message.avatarUrl}/>:message.displayName.split(/\s+/).map(p=>p[0]).join("").slice(0,2)}<i/></div>
        <div className="fz-profile-title"><h2>{message.displayName} 💜</h2><p>@{message.username}</p><span><ShieldCheck size={14}/> Проверенный пользователь</span><small>● В сети</small><em>✨ Маленькие идеи создают большие миры ✨</em></div>
        <div className="fz-profile-actions"><button><MessageCircle size={16}/> Отправить сообщение</button><button><Users size={16}/></button><button>•••</button></div>
      </header>
      <nav className="fz-profile-tabs"><b>Профиль</b><span>Общие серверы</span><span>Общие друзья</span><span>Медиа</span><span>Активность</span></nav>
      <div className="fz-profile-grid">
        <aside>
          <section><h3>О себе</h3><p>Дизайн • Технологии • Кофе • Космос 💜</p><p>Верю, что комьюнити меняют мир.</p><hr/><span><MapPin/> Алматы, Казахстан</span><span><Sparkles/> Присоединилась 12 янв. 2024</span><span><Link2/> ID: {message.authorId}</span></section>
          <section><h3>Социальные сети</h3><div className="fz-socials">◎ 𝕏 ▶ ◉ 🔗</div></section>
          <section><h3>Роли</h3><div className="fz-role-list"><b>👑 Администратор</b><b>🎨 Дизайнер</b><b>▣ Event Team</b><b>💎 Ранний доступ</b></div></section>
          <section><h3>Награды</h3><div className="fz-awards"><Award/><ShieldCheck/><Star/><Award/></div></section>
        </aside>
        <main>
          <section><h3>Статистика</h3><div className="fz-stat-grid"><span><Star/><small>Уровень</small><b>32</b><i>2 340 / 5 000 XP</i></span><span><MessageCircle/><small>Сообщений</small><b>12 430</b></span><span><Users/><small>На серверах</small><b>18</b></span><span><Users/><small>В друзьях</small><b>246</b></span></div></section>
          <section><h3>Последняя активность</h3><div className="fz-activity"><Gamepad2/><span><b>Играет в VALORANT</b><small>Уже 2 часа</small></span><button>Присоединиться</button></div></section>
          <section><h3>Сейчас на серверах · 3</h3><div className="fz-server-row"><span>🌌 <b>Pixel Craft</b><small>В голосовом канале</small></span><span>🎮 <b>GameHub</b><small>Смотрит стрим</small></span><span>🎨 <b>Creative Space</b><small>Печатает...</small></span></div></section>
          <section><h3>Медиа</h3><div className="fz-media-tabs">Все　 Изображения　 Видео　 Файлы　 Ссылки</div><div className="fz-media-grid"><i/><i/><i/><i/><i/><b>+12</b></div></section>
        </main>
      </div>
    </section>
  </div>
}