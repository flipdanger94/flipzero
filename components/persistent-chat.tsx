"use client";

import { type CSSProperties, type FormEvent, type ReactNode, Fragment, useEffect, useRef, useState } from "react";
import { CornerUpLeft, ExternalLink, Gamepad2, Link2, LoaderCircle, MapPin, MessageCircle, MessageSquareText, Mic, Pin, Search, SendHorizontal, ShieldCheck, Smile, Sparkles, Square, Star, Trash2, Users, X, ShieldAlert, UserX } from "lucide-react";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";
import { ChatGameCard, createChatGame, gameMarker } from "./chat-game-card";
import { ImageUpload } from "./image-upload";
import { ConfirmDialog, ReportDialog } from "./action-dialogs";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { UserProfilePopover } from "./user-profile-popover";
import { ChatLayout } from "./chat-layout";
import { ChatComposer } from "./chat-composer";

type Attachment = { type: "image" | "audio" | "file"; url: string; name: string; duration?: number; mimeType: string; size: number };
type PendingAttachment = { id: string; file: File; type: Attachment["type"]; previewUrl: string | null; duration?: number };
type ChatMessage = { clan?:ClanTagData|null; globalXp?:number; globalLevel?:number; cosmetics?:Record<string,string>; id: string; authorId: string; displayName: string; username: string; avatarUrl?: string | null; content: string; attachments?: Attachment[]; replyToId: string | null; editedAt?: string | null; pinnedAt?: string | null; createdAt: string; reactions: Array<{ emoji: string; userId: string }> };
type MentionSuggestion =
  | { type: "user"; id: string; username: string; displayName: string; nickname: string | null; avatarUrl?: string | null; online?: boolean }
  | { type: "role"; id: string; name: string; color: string };
const quickEmoji = ["😀", "😂", "😍", "🥰", "😎", "🤔", "😭", "🙏", "👍", "👏", "❤️", "🔥", "✨", "🎉", "💜", "👋"];

function escapeRegExp(value: string) {
  let escaped = "";
  for (const character of value) {
    if ("\\^$.*+?()[]{}|".includes(character)) escaped += "\\";
    escaped += character;
  }
  return escaped;
}

function renderMentionContent(content: string, roleNames: string[]): ReactNode[] {
  const roleSet = new Set(roleNames.map((name) => name.toLocaleLowerCase("ru")));
  const rolePattern = [...roleNames].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const targetPattern = rolePattern ? "(?:" + rolePattern + "|[\\p{L}\\p{N}_.-]+)" : "[\\p{L}\\p{N}_.-]+";
  const mentionRegex = new RegExp("(^|\\s)(@" + targetPattern + ")(?=$|\\s|[.,!?;:])", "giu");
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of content.matchAll(mentionRegex)) {
    const start = match.index ?? 0;
    const prefix = match[1] ?? "";
    const mention = match[2] ?? "";
    if (start > cursor) nodes.push(content.slice(cursor, start));
    if (prefix) nodes.push(prefix);
    const isRole = roleSet.has(mention.slice(1).toLocaleLowerCase("ru"));
    nodes.push(<span className={"chat-mention " + (isRole ? "role-mention" : "user-mention")} key={"mention-" + key++}>{mention}</span>);
    cursor = start + match[0].length;
  }

  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes;
}

function LinkPreview({ content }: { content: string }) {
  const match = content.match(/https?:\/\/[^\s<]+/i);
  if (!match) return null;
  let url: URL;
  try { url = new URL(match[0]); } catch { return null; }
  return <a className="link-unfurl" href={url.href} target="_blank" rel="noreferrer"><span>{url.hostname.replace(/^www\./, "")}</span><strong>{url.pathname === "/" ? "Открыть ссылку" : url.pathname.replace(/\/$/, "")}</strong><small>{url.href}</small><ExternalLink size={15} /></a>;
}

export function PersistentChat({ channelId, channelName, spaceId, currentUserId, ownerId, searchQuery, onOpenDirect }: { channelId: string; channelName: string; spaceId: string; currentUserId: string; ownerId?: string; searchQuery: string; onOpenDirect?: (userId:string)=>void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [pendingFiles,setPendingFiles]=useState<PendingAttachment[]>([]); const [messageLimit,setMessageLimit]=useState(1000); const [showNewMessages,setShowNewMessages]=useState(false); const [reportingMessage,setReportingMessage]=useState<ChatMessage|null>(null); const [profile, setProfile] = useState<ChatMessage | null>(null); const [profileAnchor,setProfileAnchor]=useState<{x:number;y:number}|null>(null); const [draft, setDraft] = useState(""); const [canSend, setCanSend] = useState(true); const [canReact, setCanReact] = useState(true); const [canAttach, setCanAttach] = useState(true); const [reply, setReply] = useState<ChatMessage | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [recording, setRecording] = useState(false); const [recordSeconds, setRecordSeconds] = useState(0); const [emojiOpen, setEmojiOpen] = useState(false); const [mentionQuery, setMentionQuery] = useState<string | null>(null); const [mentionItems, setMentionItems] = useState<MentionSuggestion[]>([]); const [mentionIndex, setMentionIndex] = useState(0); const [mentionStart, setMentionStart] = useState(-1); const [mentionLoading, setMentionLoading] = useState(false); const [roleNames, setRoleNames] = useState<string[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null); const streamRef = useRef<MediaStream | null>(null); const chunksRef = useRef<Blob[]>([]); const startedRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null); const followLatestRef = useRef(true); const mutationRef = useRef(false); const revisionRef = useRef(0);
  const [olderCursor,setOlderCursor]=useState<string|null>(null);const [loadingOlder,setLoadingOlder]=useState(false);const olderScrollRef=useRef<{height:number;top:number}|null>(null);const historyRef=useRef<ChatMessage[]>([]);
  async function loadOlder(){if(!olderCursor||loadingOlder||searchQuery.trim())return;const list=messageListRef.current;if(list)olderScrollRef.current={height:list.scrollHeight,top:list.scrollTop};setLoadingOlder(true);try{const response=await fetch(`/api/v1/channels/${channelId}/messages?before=${encodeURIComponent(olderCursor)}`,{cache:"no-store"});const data=await response.json();if(response.ok){setOlderCursor(data.nextCursor??null);setMessages(current=>{const previous=(data.messages as ChatMessage[]).filter(item=>!current.some(row=>row.id===item.id));const combined=[...previous,...current];historyRef.current=combined;return combined})}}finally{setLoadingOlder(false)}}
  async function load(query = searchQuery) { const response = await fetch(`/api/v1/channels/${channelId}/messages${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`); const data = await response.json(); if (response.ok) { setMessages(data.messages ?? []); setCanSend(data.permissions?.canSend !== false); setCanReact(data.permissions?.canReact !== false); setCanAttach(data.permissions?.canAttach !== false); setMessageLimit(data.messageLimit ?? 1000); } else setError(data.message ?? "Не удалось загрузить сообщения."); setLoading(false); }
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
        if (response.ok) { const firstPage=historyRef.current.length===0;setMessages(current=>{const latest=(data.messages??[]) as ChatMessage[];const existing=historyRef.current.length?historyRef.current:current;const byId=new Map(existing.map(item=>[item.id,item]));for(const item of latest)byId.set(item.id,item);const combined=[...byId.values()].sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());if(combined.length>existing.length&&!followLatestRef.current)setShowNewMessages(true);historyRef.current=combined;return combined});if(firstPage)setOlderCursor(data.nextCursor??null); setCanSend(data.permissions?.canSend !== false); setCanReact(data.permissions?.canReact !== false); setCanAttach(data.permissions?.canAttach !== false); setMessageLimit(data.messageLimit ?? 1000); setError(""); }
        else setError(data.message ?? "Не удалось загрузить сообщения.");
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) { setError("Не удалось загрузить сообщения. Повторяем попытку…"); setLoading(false); }
      } finally { inFlight = false; }
    }
    const first = window.setTimeout(() => void refresh(), 180);
    const interval = window.setInterval(() => void refresh(), 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); historyRef.current=[];setOlderCursor(null);window.clearTimeout(first); window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [channelId, searchQuery]);
  useEffect(() => { const list = messageListRef.current; if (!list)return;if(olderScrollRef.current){const previous=olderScrollRef.current;list.scrollTop=previous.top+list.scrollHeight-previous.height;olderScrollRef.current=null}else if(followLatestRef.current) list.scrollTop = list.scrollHeight; }, [messages]);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => { const seconds = Math.floor((Date.now() - startedRef.current) / 1000); setRecordSeconds(seconds); if (seconds >= 60 && recorderRef.current?.state === "recording") recorderRef.current.stop(); }, 250); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => { if (!emojiOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEmojiOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [emojiOpen]);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/spaces/" + spaceId + "/roles")
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (active && ok) setRoleNames((data.roles ?? []).map((role: { name?: string }) => role.name).filter((name: unknown): name is string => typeof name === "string"));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [spaceId]);
  useEffect(() => {
    if (mentionQuery === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMentionLoading(true);
      try {
        const response = await fetch("/api/v1/spaces/" + spaceId + "/mentions?q=" + encodeURIComponent(mentionQuery), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || controller.signal.aborted) return;
        const items = (data.items ?? []) as MentionSuggestion[];
        setMentionItems(items);
        setMentionIndex(0);
        const searchedRoles = items.filter((item): item is Extract<MentionSuggestion, { type: "role" }> => item.type === "role").map((item) => item.name);
        if (searchedRoles.length) setRoleNames((current) => [...new Set([...current, ...searchedRoles])]);
      } catch {
        if (!controller.signal.aborted) setMentionItems([]);
      } finally {
        if (!controller.signal.aborted) setMentionLoading(false);
      }
    }, 110);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [mentionQuery, spaceId]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  async function post(content: string, attachments: Attachment[] = []) { if (!canSend || (attachments.length && !canAttach)) return; if (content.length > messageLimit) { setError(`Лимит сообщения — ${messageLimit} символов.`); return; } mutationRef.current = true; revisionRef.current++; try { const gameContent=(["/quiz","/duel","/guess"].includes(content)&&!attachments.length)?await createChatGame("channel",channelId,content):content;const response = await fetch(`/api/v1/channels/${channelId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content:gameContent, attachments, replyToId: reply?.id }) }); const data = await response.json(); if (!response.ok) { setError(data.message ?? "Не удалось отправить сообщение."); return; } followLatestRef.current = true; setMessages((items) => [...items, data.message]); setDraft(""); setReply(null); void fetch("/api/v1/gamification/award", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "message", spaceId, idempotencyKey: `message:${data.message.id}` }) }); } catch { setError("Не удалось отправить сообщение. Проверьте соединение."); } finally { mutationRef.current = false; } }
  async function uploadAttachment(item: PendingAttachment) { const body=new FormData();body.append("file",item.file);if(item.duration)body.append("duration",String(item.duration));const response=await fetch("/api/messages/attachments",{method:"POST",body});const data=await response.json();if(!response.ok)throw new Error(data.message??"Не удалось загрузить вложение.");return data.attachment as Attachment; }
  function addFiles(files: File[], duration?: number) { setError(""); setPendingFiles(current=>{const available=Math.max(0,4-current.length);const accepted=files.slice(0,available).map(file=>({id:crypto.randomUUID(),file,type:(file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":"file") as Attachment["type"],previewUrl:file.type.startsWith("image/")?URL.createObjectURL(file):null,...(duration?{duration}:{})}));if(files.length>available)setError("Можно прикрепить до 4 файлов.");return [...current,...accepted]}); }
  function removePending(id:string){setPendingFiles(current=>{const target=current.find(item=>item.id===id);if(target?.previewUrl)URL.revokeObjectURL(target.previewUrl);return current.filter(item=>item.id!==id)})}
  async function send(event?: FormEvent) { event?.preventDefault(); if (!canSend) return; const content = draft.trim(); if (!content&&!pendingFiles.length)return;if(draft.length>messageLimit){setError(`Лимит сообщения — ${messageLimit} символов.`);return} setEmojiOpen(false); setMentionQuery(null); setMentionItems([]); try{const attachments=await Promise.all(pendingFiles.map(uploadAttachment));await post(content,attachments);pendingFiles.forEach(item=>item.previewUrl&&URL.revokeObjectURL(item.previewUrl));setPendingFiles([]);}catch(reason){setError(reason instanceof Error?reason.message:"Не удалось отправить вложение.")} }
  function syncMentionQuery(value: string, cursor: number) {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([\p{L}\p{N}_.-]{0,48})$/u);
    if (!match) {
      setMentionQuery(null);
      setMentionItems([]);
      setMentionStart(-1);
      return;
    }
    setMentionStart(beforeCursor.lastIndexOf("@"));
    setMentionQuery(match[1] ?? "");
    setMentionIndex(0);
    setEmojiOpen(false);
  }
  function chooseMention(item: MentionSuggestion) {
    const input = composerRef.current;
    const cursor = input?.selectionStart ?? draft.length;
    const start = mentionStart >= 0 ? mentionStart : Math.max(0, cursor - (mentionQuery?.length ?? 0) - 1);
    const label = item.type === "user" ? "@" + item.username : "@" + item.name;
    const next = draft.slice(0, start) + label + " " + draft.slice(cursor);
    const caret = start + label.length + 1;
    setDraft(next);
    setMentionQuery(null);
    setMentionItems([]);
    setMentionIndex(0);
    setMentionStart(-1);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(caret, caret); });
  }
  function insertEmoji(emoji: string) { const input = composerRef.current; const start = input?.selectionStart ?? draft.length; const end = input?.selectionEnd ?? draft.length; setDraft((current) => `${current.slice(0,start)}${emoji}${current.slice(end)}`); setEmojiOpen(false); requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length,start + emoji.length); }); }
  async function startRecording() { if (!canSend || !canAttach) { setError("У вас нет права отправлять вложения в этом канале."); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); streamRef.current = stream; recorderRef.current = recorder; chunksRef.current = []; startedRef.current = Date.now(); setRecordSeconds(0); recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); }; recorder.onstop = () => { const duration = Math.max(1, Math.round((Date.now() - startedRef.current) / 1000)); const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); const file=new File([blob],"voice-message."+(blob.type.includes("mp4")?"m4a":"webm"),{type:blob.type}); void (async()=>{try{const attachment=await uploadAttachment({id:crypto.randomUUID(),file,type:"audio",previewUrl:null,duration});await post("Голосовое сообщение",[attachment]);}catch(reason){setError(reason instanceof Error?reason.message:"Не удалось отправить голосовое сообщение.")}})(); stream.getTracks().forEach((track) => track.stop()); setRecording(false); }; recorder.start(); setRecording(true); } catch { setError("Не удалось получить доступ к микрофону."); } }
  function stopRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }
  async function react(messageId: string, emoji: string) { if (!canReact) return; await fetch(`/api/v1/channels/${channelId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "react", messageId, emoji }) }); await load(); }
  async function pin(messageId: string) { await fetch(`/api/v1/channels/${channelId}/messages`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "pin", messageId }) }); await load(); }
  function reportMessage(message: ChatMessage) { if (message.authorId !== currentUserId) setReportingMessage(message); }
  async function remove(messageId: string) { await fetch(`/api/v1/channels/${channelId}/messages?messageId=${messageId}`, { method: "DELETE" }); setMessages((items) => items.filter((item) => item.id !== messageId)); }
  return <>{reportingMessage ? <ReportDialog targetType="message" targetId={reportingMessage.id} onClose={() => setReportingMessage(null)} onSuccess={() => setError("Жалоба на сообщение отправлена модерации.")} /> : null}{profile ? <UserProfilePopover key={profile.authorId} userId={profile.authorId} displayName={profile.displayName} anchor={profileAnchor} onClose={() => { setProfile(null); setProfileAnchor(null); }} onOpenDirect={onOpenDirect} /> : null}<ChatLayout className="channel-chat-layout" feed={<><div className={`message-list ${messages.length?"has-messages":""}`} ref={messageListRef} onScroll={(event) => { const list = event.currentTarget; followLatestRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 96;if(followLatestRef.current)setShowNewMessages(false);if(list.scrollTop<100&&olderCursor&&!loadingOlder)void loadOlder(); }}>{olderCursor?<button type="button" className="direct-load-older" disabled={loadingOlder} onClick={()=>void loadOlder()}>{loadingOlder?"Загружаем…":"Загрузить предыдущие сообщения"}</button>:null}<div className="channel-intro"><div className="intro-icon"><MessageSquareText size={31} /></div><h1>#{channelName}</h1><p>Напишите первое сообщение.</p></div>{loading ? <div className="chat-loading"><LoaderCircle className="spin" /> Загружаем сообщения...</div> : messages.length ? messages.map((message, index) => { const previous = messages[index - 1]; const elapsed = previous ? new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() : 0; const newDay = !previous || new Date(message.createdAt).toDateString() !== new Date(previous.createdAt).toDateString(); const separated = newDay || elapsed > 30 * 60_000; const grouped = !separated && previous.authorId === message.authorId && elapsed < 5 * 60_000 && !message.replyToId; return <Fragment key={message.id}>{separated ? <div className="day-divider"><span>{new Date(message.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", ...(newDay ? {} : { hour: "2-digit", minute: "2-digit" }) })}</span></div> : null}<article className={`message persistent-message ${message.authorId===currentUserId?"mine":""} ${grouped ? "grouped-message" : ""} ${message.cosmetics?.message_effect?`effect-${message.cosmetics.message_effect}`:""}`}>{grouped ? <div className="message-time-gutter" title={new Date(message.createdAt).toLocaleString("ru-RU")}>{new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" })}</div> : <button type="button" className={`avatar avatar-coral profile-avatar-trigger frame-${message.cosmetics?.avatar_frame??"none"}`} aria-label={`Открыть профиль ${message.displayName}`} title={`Открыть профиль ${message.displayName}`} onClick={(event)=>{const rect=event.currentTarget.getBoundingClientRect();setProfileAnchor({x:rect.right+8,y:Math.max(12,rect.top-16)});setProfile(message)}}>{message.avatarUrl ? <MediaImage src={message.avatarUrl} /> : message.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</button>}<div className="message-body">{!grouped ? <div className="message-meta"><button type="button" className={`profile-name-trigger ${message.cosmetics?.nickname?`nick-${message.cosmetics.nickname}`:""}`} onClick={(event)=>{const rect=event.currentTarget.getBoundingClientRect();setProfileAnchor({x:rect.left,y:rect.bottom+8});setProfile(message)}}>{message.displayName}</button><ClanTag clan={message.clan}/><time>{new Date(message.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>{message.editedAt ? <small>изменено</small> : null}{message.pinnedAt ? <Pin size={12} /> : null}</div> : null}{message.replyToId ? <small className="reply-mark"><CornerUpLeft size={11} /> Ответ на сообщение</small> : null}{gameMarker(message.content)?<ChatGameCard id={gameMarker(message.content)!} currentUserId={currentUserId}/>:<p>{renderMentionContent(message.content, roleNames)}</p>}{message.attachments?.map((item,index)=>item.type==="audio"?<div className="voice-message" key={index}><Mic size={16}/><audio controls preload="metadata" src={item.url}/><span>{item.duration??0} сек.</span></div>:item.type==="image"?<a className="chat-image-attachment" key={index} href={item.url} target="_blank" rel="noreferrer"><MediaImage src={item.url} alt={item.name}/></a>:<a className="chat-file-attachment" key={index} href={item.url} target="_blank" rel="noreferrer"><Link2 size={16}/><span>{item.name}</span></a>)}<LinkPreview content={message.content} /><div className="reactions">{[...new Set(message.reactions.map((item) => item.emoji))].map((emoji) => <button key={emoji} onClick={() => react(message.id, emoji)}>{emoji} {message.reactions.filter((item) => item.emoji === emoji).length}</button>)}<button onClick={() => react(message.id, "🔥")}>🔥</button></div></div><div className="message-actions"><button title="Ответить" onClick={() => setReply(message)}><CornerUpLeft size={14} /></button>{message.authorId !== currentUserId ? <button title="Пожаловаться" onClick={() => void reportMessage(message)}><ShieldAlert size={14} /></button> : null}{ownerId === currentUserId ? <button title="Закрепить" onClick={() => pin(message.id)}><Pin size={14} /></button> : null}{message.authorId === currentUserId || ownerId === currentUserId ? <button title="Удалить" onClick={() => remove(message.id)}><Trash2 size={14} /></button> : null}</div></article></Fragment>;}) : searchQuery ? <div className="search-empty"><Search size={24}/><strong>Ничего не найдено</strong><span>Попробуйте другой запрос.</span></div> : null}{error ? <div className="auth-error">{error}</div> : null}</div>{showNewMessages?<button type="button" className="chat-new-messages" onClick={()=>{const list=messageListRef.current;if(list){list.scrollTop=list.scrollHeight;followLatestRef.current=true;setShowNewMessages(false)}}}>↓ Новые сообщения</button>:null}</>} composer={<div className={`composer-wrap ${canSend ? "" : "composer-locked"}`}>{canSend && mentionQuery !== null ? <div className="mention-picker" role="listbox" aria-label="Упоминания"><header><strong>Упоминания</strong><small>Люди и роли</small></header>{mentionLoading ? <div className="mention-picker-state"><LoaderCircle className="spin" size={16}/> Ищем…</div> : mentionItems.length ? mentionItems.map((item,index)=><button key={item.type+":"+item.id} type="button" role="option" aria-selected={index===mentionIndex} className={index===mentionIndex?"active":""} onMouseDown={event=>event.preventDefault()} onClick={()=>chooseMention(item)}>{item.type==="user"?<><span className="mention-avatar">{item.avatarUrl?<MediaImage src={item.avatarUrl}/>: (item.nickname||item.displayName).slice(0,2).toLocaleUpperCase("ru")}<i className={item.online?"online":""}/></span><span className="mention-copy"><strong>{item.nickname||item.displayName}</strong><small>@{item.username}</small></span></>:<><span className="mention-role-icon" style={{"--mention-role-color":item.color} as CSSProperties}><ShieldCheck size={16}/></span><span className="mention-copy"><strong>@{item.name}</strong><small>Роль сообщества</small></span></>}</button>) : <div className="mention-picker-state">Ничего не найдено</div>}</div>:null}{canSend&&emojiOpen?<div className="composer-emoji-picker" role="group" aria-label="Выберите эмодзи">{quickEmoji.map(emoji=><button key={emoji} type="button" onClick={()=>insertEmoji(emoji)}>{emoji}</button>)}</div>:null}{canSend&&reply?<div className="replying"><span>Ответ для <b>{reply.displayName}</b></span><button onClick={()=>setReply(null)}>×</button></div>:null}<ChatComposer value={draft} onChange={(value)=>{setDraft(value);syncMentionQuery(value,composerRef.current?.selectionStart??value.length)}} onSubmit={()=>void send()} placeholder={`Написать в #${channelName}`} disabled={!canSend} disabledText="У вас недостаточно прав, чтобы отправлять сообщения в этом канале." busy={false} limit={messageLimit} hasAttachments={pendingFiles.length>0} onFiles={canAttach?addFiles:undefined} onEmoji={()=>{setMentionQuery(null);setMentionItems([]);setEmojiOpen(open=>!open)}} onVoice={canAttach?(recording?stopRecording:()=>void startRecording()):undefined} recording={recording} recordingSeconds={recordSeconds} textareaRef={composerRef} onKeyDown={(event)=>{if(mentionQuery!==null&&mentionItems.length){if(event.key==="ArrowDown"){event.preventDefault();setMentionIndex(index=>(index+1)%mentionItems.length);return}if(event.key==="ArrowUp"){event.preventDefault();setMentionIndex(index=>(index-1+mentionItems.length)%mentionItems.length);return}if((event.key==="Enter"||event.key==="Tab")&&!event.shiftKey){event.preventDefault();chooseMention(mentionItems[mentionIndex]??mentionItems[0]);return}if(event.key==="Escape"){event.preventDefault();setMentionQuery(null);setMentionItems([])}}}} attachmentPreview={pendingFiles.length?<div className="chat-attachment-preview">{pendingFiles.map(item=><article key={item.id}>{item.previewUrl?<div className="chat-attachment-thumb" style={{backgroundImage:`url("${item.previewUrl}")`}}/>:<Link2 size={18}/>}<span><strong>{item.file.name}</strong><small>{Math.ceil(item.file.size/1024)} КБ</small></span><button type="button" onClick={()=>removePending(item.id)} aria-label="Удалить вложение"><X size={14}/></button></article>)}</div>:null}/></div>} /></>;
}


type UserProfile = { clan?:ClanTagData|null; id:string; username:string; displayName:string; avatarUrl?:string|null; bannerUrl?:string|null; bio?:string|null; accentColor:string; presence:string; globalXp:number; globalLevel:number; createdAt:string; profileLocation?:string|null; profileStatus?:string|null; profileLinks:string[]; isOwnProfile:boolean; isFriend:boolean; friendshipStatus?:"friends"|"outgoing"|"incoming"|"none"; incomingRequestId?:string|null; stats:{messages:number;friends:number;servers:number}; servers:Array<{id:string;name:string;iconUrl?:string|null}> };

export function ProfileModal({ userId, displayName, onClose, onOpenDirect }: { userId: string; displayName: string; onClose: () => void; onOpenDirect?: (userId: string) => void }) {
  const dialogRef = useModalA11y(onClose);
  const [reloadNonce,setReloadNonce]=useState(0);
  const [profile,setProfile]=useState<UserProfile|null>(null); const [editing,setEditing]=useState(false); const [form,setForm]=useState<UserProfile|null>(null); const [saving,setSaving]=useState(false); const [profileError,setProfileError]=useState(""); const [showBlockConfirm,setShowBlockConfirm]=useState(false); const [showReport,setShowReport]=useState(false); const [tab,setTab]=useState<"profile"|"servers"|"friends"|"media"|"activity">("profile"); const [copied,setCopied]=useState(false); const [actionBusy,setActionBusy]=useState(false); const [actionNotice,setActionNotice]=useState("");
  useEffect(()=>{let live=true;const task=window.setTimeout(()=>{setProfileError("");setProfile(null);fetch(`/api/v1/users/${userId}/profile`).then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{if(!live)return;if(ok&&data.profile){setProfile(data.profile);setForm(data.profile)}else setProfileError(data.message??"Не удалось загрузить профиль.")}).catch(()=>{if(live)setProfileError("Не удалось загрузить профиль.")})},0);return()=>{live=false;window.clearTimeout(task)}},[userId,reloadNonce]);
  async function save(){if(!form)return;setSaving(true);const r=await fetch("/api/v1/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:form.displayName,bio:form.bio??"",avatarUrl:form.avatarUrl??null,bannerUrl:form.bannerUrl??null,profileLocation:form.profileLocation??"",profileStatus:form.profileStatus??"",profileLinks:form.profileLinks??[],accentColor:form.accentColor??"#8b5cf6"})});const d=await r.json();if(r.ok){setProfile(p=>p?{...p,...d.profile}:p);setEditing(false)}setSaving(false)}
  const p=profile?.id===userId?profile:null;
  async function blockUser(){if(!p||p.isOwnProfile||actionBusy)return;setActionBusy(true);try{const r=await fetch("/api/blocks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({userId:p.id})});const d=await r.json();if(r.ok){setActionNotice("Пользователь заблокирован.");setProfile({...p,isFriend:false,friendshipStatus:"none"})}else setActionNotice(d.message??"Не удалось заблокировать пользователя.")}catch{setActionNotice("Не удалось заблокировать пользователя.")}finally{setActionBusy(false)}}
  function reportUser(){if(p&&!p.isOwnProfile&&!actionBusy)setShowReport(true)}
  async function friendAction(){if(!p||actionBusy)return;setActionBusy(true);setActionNotice("");try{if(p.friendshipStatus==="friends"){const r=await fetch(`/api/friends?friendId=${p.id}`,{method:"DELETE"});if(!r.ok)throw new Error();setProfile({...p,isFriend:false,friendshipStatus:"none"});setActionNotice("Удалён из друзей")}else if(p.friendshipStatus==="incoming"&&p.incomingRequestId){const r=await fetch("/api/friends",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:p.incomingRequestId,status:"accepted"})});if(!r.ok)throw new Error();setProfile({...p,isFriend:true,friendshipStatus:"friends"});setActionNotice("Теперь вы друзья")}else if(p.friendshipStatus!=="outgoing"){const r=await fetch("/api/friends",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({toId:p.id})});if(!r.ok)throw new Error();setProfile({...p,friendshipStatus:"outgoing"});setActionNotice("Заявка отправлена")}}catch{setActionNotice("Не удалось выполнить действие")}finally{setActionBusy(false)}}
  return <div className="fz-profile-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialogRef} tabIndex={-1} className="fz-profile-modal" role="dialog" aria-modal="true" aria-label={`Профиль ${displayName}`} style={{ "--profile-accent": p?.accentColor ?? "#a855f7" } as CSSProperties}>
      <button className="fz-profile-close" onClick={onClose} aria-label="Закрыть профиль"><X size={20}/></button>
      {!p?<div className="fz-profile-state">{profileError?<><ShieldCheck/><b>Профиль временно недоступен</b><p>{profileError}</p><div className="fz-profile-state-actions"><button onClick={()=>setReloadNonce((value)=>value+1)}>Повторить</button><button onClick={onClose}>Закрыть</button></div></>:<><LoaderCircle className="spin"/><span>Загружаем профиль...</span></>}</div>:<>
      <header className="fz-profile-hero" style={p.bannerUrl?{backgroundImage:`linear-gradient(180deg,transparent,#07101d),url("${p.bannerUrl}")`}:undefined}>
        <div className="fz-profile-avatar">{p.avatarUrl?<MediaImage src={p.avatarUrl}/>:p.displayName.slice(0,2)}<i/></div>
        <div className="fz-profile-title"><h2>{p.displayName}</h2><ClanTag clan={p.clan} details/><p>@{p.username}</p><small>Уровень {p.globalLevel} · ● {p.presence==="offline"?"Не в сети":"В сети"}</small><em>{p.profileStatus||"✨ Создаю свой мир в FlipZero"}</em></div>
        <div className="fz-profile-actions">{p.isOwnProfile?<button onClick={()=>setEditing(true)}>Редактировать профиль</button>:<><button onClick={()=>{onClose();onOpenDirect?.(p.id)}}><MessageCircle size={16}/> Написать</button><button className={p.friendshipStatus==="friends"?"is-friend":""} disabled={actionBusy||p.friendshipStatus==="outgoing"} onClick={friendAction}><Users size={16}/>{p.friendshipStatus==="friends"?"В друзьях":p.friendshipStatus==="outgoing"?"Заявка отправлена":p.friendshipStatus==="incoming"?"Принять заявку":"Добавить в друзья"}</button></>}{!p.isOwnProfile?<button className="fz-icon-action" title="Заблокировать" disabled={actionBusy} onClick={()=>setShowBlockConfirm(true)}><UserX size={16}/></button>:null}{!p.isOwnProfile?<button className="fz-icon-action" title="Пожаловаться" disabled={actionBusy} onClick={reportUser}><ShieldAlert size={16}/></button>:null}<button className="fz-icon-action" title="Скопировать ID" onClick={async()=>{await navigator.clipboard?.writeText(p.id);setCopied(true);setTimeout(()=>setCopied(false),1400)}}><Link2 size={16}/>{copied?<span>Скопировано</span>:null}</button></div>
      </header>
      <nav className="fz-profile-tabs">{([["profile","Профиль"],["servers","Пространства"],["friends","Друзья"],["media","Медиа"],["activity","Активность"]] as const).map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}</nav>
      <div className="fz-profile-content">
      {tab==="profile"?<div className="fz-profile-grid"><aside><section><h3>О себе</h3><p>{p.bio||"Пользователь пока ничего о себе не рассказал."}</p><hr/><span><MapPin/> {p.profileLocation||"Местоположение не указано"}</span><span><Sparkles/> В FlipZero с {new Date(p.createdAt).toLocaleDateString("ru-RU")}</span><span><Link2/> @{p.username}</span></section>{p.profileLinks?.length?<section><h3>Ссылки</h3>{p.profileLinks.map(link=><a key={link} href={link} target="_blank" rel="noreferrer"><ExternalLink/> {link}</a>)}</section>:null}</aside><main><section><h3>Статистика</h3><div className="fz-stat-grid"><span><Star/><small>Уровень</small><b>{p.globalLevel}</b><i>{p.globalXp} XP</i></span><span><MessageCircle/><small>Сообщений</small><b>{p.stats.messages}</b></span><span><Users/><small>Пространств</small><b>{p.stats.servers}</b></span><span><Users/><small>Друзей</small><b>{p.stats.friends}</b></span></div></section><section><h3>Пространства</h3><div className="fz-server-row">{p.servers.length?p.servers.map(s=><span key={s.id}>{s.iconUrl?<MediaImage src={s.iconUrl}/>:<i className="fz-space-initials">{s.name.slice(0,2).toLocaleUpperCase("ru")}</i>}<b>{s.name}</b></span>):<p>Пока нет пространств.</p>}</div></section></main></div>:null}
      {tab==="servers"?<section className="fz-profile-tabpage"><h3><Users/> Пространства пользователя</h3><div className="fz-server-row">{p.servers.length?p.servers.map(s=><span key={s.id}>{s.iconUrl?<MediaImage src={s.iconUrl}/>:<i className="fz-space-initials">{s.name.slice(0,2).toLocaleUpperCase("ru")}</i>}<b>{s.name}</b></span>):<p>Нет доступных пространств.</p>}</div></section>:null}
      {tab==="friends"?<section className="fz-profile-tabpage fz-empty-tab"><Users/><h3>{p.stats.friends} {new Intl.PluralRules("ru-RU").select(p.stats.friends)==="one"?"друг":new Intl.PluralRules("ru-RU").select(p.stats.friends)==="few"?"друга":"друзей"}</h3><p>{p.isFriend?"Вы уже друзья в FlipZero.":"Здесь будут отображаться общие друзья."}</p></section>:null}
      {tab==="media"?<section className="fz-profile-tabpage fz-empty-tab"><MessageSquareText/><h3>Медиа</h3><p>Фото, видео и вложения пользователя появятся здесь.</p></section>:null}
      {tab==="activity"?<section className="fz-profile-tabpage"><h3><Users/> Активность</h3><div className="fz-activity">{p.presence==="offline"?<Users/>:<Gamepad2/>}<span><b>{p.presence==="offline"?"Сейчас не в сети":"Сейчас в FlipZero"}</b><small>{p.profileStatus||"Без пользовательского статуса"}</small></span></div></section>:null}
      </div>
      {showBlockConfirm?<ConfirmDialog title="Заблокировать пользователя?" description={`@${p.username}: дружба и заявки будут удалены, личные сообщения станут недоступны.`} confirmLabel="Заблокировать" destructive busy={actionBusy} onCancel={()=>setShowBlockConfirm(false)} onConfirm={()=>{setShowBlockConfirm(false);void blockUser()}}/>:null}{showReport?<ReportDialog targetType="user" targetId={p.id} onClose={()=>setShowReport(false)} onSuccess={()=>setActionNotice("Жалоба отправлена модерации.")}/>:null}
      {actionNotice?<div className="fz-profile-toast">{actionNotice}</div>:null}{editing&&form?<div className="fz-profile-editor"><div><h3>Редактировать профиль</h3><button onClick={()=>setEditing(false)}><X/></button></div><label>Имя<input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label><label>О себе<textarea value={form.bio??""} onChange={e=>setForm({...form,bio:e.target.value})}/></label><label>Статус<input value={form.profileStatus??""} onChange={e=>setForm({...form,profileStatus:e.target.value})}/></label><label>Местоположение<input value={form.profileLocation??""} onChange={e=>setForm({...form,profileLocation:e.target.value})}/></label><div className="space-media-preview"><div className="space-media-banner" style={form.bannerUrl?{backgroundImage:`url("${form.bannerUrl}")`}:undefined}/><span className="space-media-icon">{form.avatarUrl?<MediaImage src={form.avatarUrl}/>:form.displayName.slice(0,2)}</span></div><div className="space-media-controls"><ImageUpload kind="avatar" label="Загрузить аватар" currentUrl={form.avatarUrl} onUploaded={result=>{const avatarUrl=(result.user?.avatarUrl as string|null)??null;setForm(current=>current?{...current,avatarUrl}:current);setProfile(current=>current?{...current,avatarUrl}:current)}}/><ImageUpload kind="accountBanner" label="Загрузить баннер" currentUrl={form.bannerUrl} onUploaded={result=>{const bannerUrl=(result.user?.bannerUrl as string|null)??null;setForm(current=>current?{...current,bannerUrl}:current);setProfile(current=>current?{...current,bannerUrl}:current)}}/></div><label>Цвет профиля<input type="color" value={form.accentColor??"#8b5cf6"} onChange={e=>setForm({...form,accentColor:e.target.value})}/></label><button className="fz-profile-save" disabled={saving} onClick={save}>{saving?"Сохраняем...":"Сохранить профиль"}</button></div>:null}
      </>}
    </section>
  </div>
}
