"use client";

import { type DragEvent, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Ban, Clock3, Crown, File as FileIcon, FilePlus2, Image as ImageIcon, LoaderCircle, MapPin, MessageCircle,
  MessageSquarePlus, Mic, PanelRightClose, PanelRightOpen, Phone, Search, SendHorizontal, ShieldCheck, Smile,
  Sparkles, Star, UserCheck, UserPlus, UserRoundPlus, Users, Video, X, Zap,
} from "lucide-react";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";
import { DirectCallOverlay } from "./direct-call-overlay";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { UserProfilePopover } from "./user-profile-popover";
import { PersonalEconomy } from "./personal-economy";
import { ChatGameCard, createChatGame, gameMarker } from "./chat-game-card";
import { ChatLayout } from "./chat-layout";
import { ChatComposer } from "./chat-composer";
import { StoryStrip } from "./story-strip";

type Person = { clan?:ClanTagData|null; globalLevel?:number; globalXp?:number; cosmetics?:Record<string,string>; id: string; username: string; displayName: string; avatarUrl?: string | null; presence?: string };
type CommonFriend = { id:string; username:string; displayName:string; avatarUrl:string|null };
type CommonServer = { id:string; name:string; iconUrl:string|null };
type ProfileDetails = {
  id:string; username:string; displayName:string; avatarUrl:string|null; bannerUrl?:string|null; bio:string|null; clan?:ClanTagData|null;
  profileLocation:string|null; profileStatus:string|null; presence:string; globalLevel:number; globalXp?:number;
  stats:{messages:number;friends:number;servers:number}; servers:Array<{id:string;name:string;iconUrl:string|null}>;
  commonFriends:CommonFriend[]; commonServers:CommonServer[];
};
type FriendRequest = { id: string; from: Person };
type OutgoingFriendRequest = { id: string; to: Person };
type Conversation = { id: string; other: Person; unread: number; lastMessage: { text: string; createdAt: string } | null };
type DirectAttachment = { type:"image"|"audio"|"file"; url:string; name:string; mimeType:string; size:number; duration?:number };
type DirectMessage = { clan?:ClanTagData|null; id: string; senderId: string; receiverId: string; text: string; attachments?:DirectAttachment[]; createdAt: string };
type PendingAttachment = { id:string; file:File; type:"image"|"audio"|"file"; previewUrl:string|null; duration?:number };
type CallMode = "voice" | "video" | null;
type FriendView = "online"|"all"|"pending"|"blocked"|"add";

const quickEmoji = ["😀","😂","😍","🥰","😎","🤔","😭","🙏","👍","👏","❤️","🔥","✨","🎉","💜","👋","🚀","✅","💯","👀"];

export function SocialHubDialog({ currentUserId, initialTab = "messages", initialUserId, onClose, embedded = false, isAdmin = false, onOpenAdmin }: { currentUserId: string; initialTab?: "messages" | "friends" | "superflip"; initialUserId?: string | null; onClose?: () => void; embedded?: boolean; isAdmin?: boolean; onOpenAdmin?: () => void }) {
  const [tab, setTab] = useState<"messages"|"friends"|"superflip"|"economy">(initialTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests,setOutgoingRequests]=useState<OutgoingFriendRequest[]>([]);
  const [blocked, setBlocked] = useState<Person[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [friendView,setFriendView]=useState<FriendView>("online");
  const [conversationQuery,setConversationQuery]=useState("");
  const [profilePopup,setProfilePopup]=useState<{person:Person;anchor:{x:number;y:number}|null}|null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [profileVisible, setProfileVisible] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const directMessagesRef = useRef<HTMLDivElement | null>(null);
  const followLatestRef = useRef(true);
  const olderScrollRef = useRef<{height:number;top:number}|null>(null);
  const activeConversationRef = useRef<string|null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(0);
  const modalRef = useModalA11y(onClose ?? (() => undefined), !embedded && Boolean(onClose));
  const [superflip, setSuperflip] = useState<{ status:"not_launched"|"trial_active"|"active"|"expired"; active:boolean; waitlisted:boolean; source?:string|null; reason?:string|null; grantedAt?:string|null; expiresAt?:string|null; capabilities?:{directMessageLimit:number;profileBioLimit:number;avatarUploadMb:number;bannerUploadMb:number;animatedProfileMedia:boolean} } | null>(null);

  const messageLimit = superflip?.capabilities?.directMessageLimit ?? 1000;
  const overLimit = draft.length > messageLimit;

  const loadFriends = useCallback(async () => {
    const response = await fetch("/api/friends", { cache:"no-store" });
    const data = await response.json();
    if (response.ok) { setFriends(data.friends ?? []); setRequests(data.requests ?? []); setOutgoingRequests(data.outgoingRequests ?? []); }
  }, []);
  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/messages", { cache:"no-store" });
    const data = await response.json();
    if (response.ok) setConversations(data.conversations ?? []);
  }, []);
  const loadBlocked = useCallback(async () => {
    const response = await fetch("/api/blocks", { cache:"no-store" });
    const data = await response.json();
    if (response.ok) setBlocked((data.blocked ?? []).map((item:Person)=>({...item,presence:"offline"})));
  }, []);
  const loadMessages = useCallback(async (conversation: Conversation, options?: { cursor?: string; mergeLatest?: boolean }) => {
    if (!conversation.id) { setMessages([]); setMessageCursor(null); return; }
    const params = new URLSearchParams({ conversationId: conversation.id, limit: "50" });
    if (options?.cursor) params.set("cursor", options.cursor);
    const response = await fetch(`/api/messages?${params.toString()}`, { cache:"no-store" });
    const data = await response.json();
    if (!response.ok || activeConversationRef.current !== conversation.id) return;
    const incoming = (data.messages ?? []) as DirectMessage[];
    if (options?.mergeLatest) {
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        for (const message of incoming) byId.set(message.id, message);
        return [...byId.values()].sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());
      });
      return;
    }
    if (options?.cursor) setMessages((current) => [...incoming.filter((message)=>!current.some((item)=>item.id===message.id)), ...current]);
    else setMessages(incoming);
    setMessageCursor(data.nextCursor ?? null);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const statusResponse = await fetch("/api/superflip/status", { cache:"no-store" });
      if (!statusResponse.ok) throw new Error("Не удалось загрузить состояние SuperFlip.");
      const status = await statusResponse.json();
      await Promise.all([loadFriends(), loadConversations(), loadBlocked()]);
      setSuperflip(status); setLoadError("");
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Не удалось загрузить Social Hub.");
    } finally { setLoading(false); }
  }, [loadBlocked, loadConversations, loadFriends]);

  useEffect(()=>{const task=window.setTimeout(()=>void loadInitial(),0);return()=>window.clearTimeout(task)},[loadInitial]);
  useEffect(() => {
    if (!initialUserId || loading) return;
    const existing = conversations.find((item)=>item.other.id===initialUserId);
    if (existing) { const task=window.setTimeout(()=>{setActive(existing);setTab("messages");setProfileVisible(true)},0); return()=>window.clearTimeout(task); }
    const controller=new AbortController();
    fetch(`/api/v1/users/${initialUserId}/profile`,{signal:controller.signal,cache:"no-store"}).then((response)=>response.json()).then((data)=>{
      if(data.profile){setActive({id:"",other:{id:data.profile.id,username:data.profile.username,displayName:data.profile.displayName,avatarUrl:data.profile.avatarUrl,presence:data.profile.presence,clan:data.profile.clan},unread:0,lastMessage:null});setTab("messages");setProfileVisible(true)}
    }).catch(()=>undefined);
    return()=>controller.abort();
  },[initialUserId,loading,conversations]);
  useEffect(() => {
    if (!active) return;
    const selected=active;
    activeConversationRef.current=selected.id;
    const initialTask=window.setTimeout(()=>{setMessages([]);setMessageCursor(null);followLatestRef.current=true;void loadMessages(selected)},0);
    const timer=window.setInterval(()=>void loadMessages(selected,{mergeLatest:true}),4000);
    return()=>{activeConversationRef.current=null;window.clearTimeout(initialTask);window.clearInterval(timer)};
  },[active,loadMessages]);
  useEffect(()=>{const list=directMessagesRef.current;if(!list)return;if(olderScrollRef.current){const previous=olderScrollRef.current;list.scrollTop=previous.top+list.scrollHeight-previous.height;olderScrollRef.current=null}else if(followLatestRef.current)list.scrollTop=list.scrollHeight},[messages]);
  useEffect(()=>{const refresh=()=>{if(document.visibilityState==="visible")void loadConversations()};const timer=window.setInterval(refresh,3000);document.addEventListener("visibilitychange",refresh);return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh)}},[loadConversations]);
  useEffect(()=>()=>{recordingStreamRef.current?.getTracks().forEach((track)=>track.stop())},[]);
  useEffect(()=>{if(!recording)return;const timer=window.setInterval(()=>{const seconds=Math.floor((Date.now()-recordingStartedRef.current)/1000);setRecordSeconds(seconds);if(seconds>=300&&recorderRef.current?.state==="recording")recorderRef.current.stop()},250);return()=>window.clearInterval(timer)},[recording]);

  async function loadOlderMessages(){if(!active?.id||!messageCursor||loadingOlder)return;const list=directMessagesRef.current;if(list)olderScrollRef.current={height:list.scrollHeight,top:list.scrollTop};setLoadingOlder(true);try{await loadMessages(active,{cursor:messageCursor})}finally{setLoadingOlder(false)}}
  async function search(event:FormEvent<HTMLFormElement>){event.preventDefault();const query=String(new FormData(event.currentTarget).get("q")??"");const response=await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);const data=await response.json();setResults(data.users??[])}
  async function requestFriend(toId:string){const response=await fetch("/api/friends",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({toId})});const data=await response.json();setNotice(response.ok?"Заявка отправлена.":data.message);await loadFriends()}
  async function respond(requestId:string,status:"accepted"|"declined"){await fetch("/api/friends",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({requestId,status})});await loadFriends();await loadConversations()}
  async function removeFriend(friendId:string){await fetch(`/api/friends?friendId=${friendId}`,{method:"DELETE"});await loadFriends()}
  async function cancelFriendRequest(requestId:string){const response=await fetch(`/api/friends?requestId=${requestId}`,{method:"DELETE"});if(response.ok){setNotice("Заявка отменена.");await loadFriends()}else setNotice("Не удалось отменить заявку.")}
  async function unblock(userId:string){const response=await fetch(`/api/blocks?userId=${userId}`,{method:"DELETE"});if(response.ok){setNotice("Пользователь разблокирован.");await Promise.all([loadBlocked(),loadFriends()])}else setNotice("Не удалось разблокировать пользователя.")}

  function addFiles(files: File[], duration?:number) {
    setNotice("");
    setPendingFiles((current)=>{
      const available=Math.max(0,4-current.length);
      const accepted=files.slice(0,available).map((file)=>({
        id:crypto.randomUUID(), file,
        type:(file.type.startsWith("image/")?"image":file.type.startsWith("audio/")?"audio":"file") as PendingAttachment["type"],
        previewUrl:file.type.startsWith("image/")?URL.createObjectURL(file):null,
        ...(duration?{duration}:{}),
      }));
      if(files.length>available)setNotice("Можно прикрепить до 4 файлов к одному сообщению.");
      return [...current,...accepted];
    });
  }
  function removePending(id:string){setPendingFiles((current)=>{const target=current.find((item)=>item.id===id);if(target?.previewUrl)URL.revokeObjectURL(target.previewUrl);return current.filter((item)=>item.id!==id)})}
  function onDrop(event:DragEvent<HTMLDivElement>){event.preventDefault();setDragging(false);addFiles([...event.dataTransfer.files])}
  async function uploadAttachment(item:PendingAttachment){
    const body=new FormData();body.append("file",item.file);if(item.duration)body.append("duration",String(item.duration));
    const response=await fetch("/api/messages/attachments",{method:"POST",body});
    const data=await response.json();if(!response.ok)throw new Error(data.message??"Не удалось загрузить вложение.");return data.attachment as DirectAttachment;
  }
  async function sendMessage(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();if(!active?.other||sending)return;
    const text=draft.trim();if(!text&&!pendingFiles.length)return;
    if(draft.length>messageLimit){setNotice(`Лимит сообщения — ${messageLimit} символов.`);return}
    setSending(true);setNotice("");setEmojiOpen(false);
    try{
      const attachments=await Promise.all(pendingFiles.map(uploadAttachment));
      const gameText=(["/quiz","/duel"].includes(text)&&!attachments.length&&active.id)?await createChatGame("direct",active.id,text):text;
      const response=await fetch("/api/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({receiverId:active.other.id,text:gameText,attachments})});
      const data=await response.json().catch(()=>null);
      if(!response.ok){setNotice(data?.message??"Не удалось отправить сообщение.");return}
      pendingFiles.forEach((item)=>item.previewUrl&&URL.revokeObjectURL(item.previewUrl));setPendingFiles([]);setDraft("");followLatestRef.current=true;
      setMessages((current)=>current.some((item)=>item.id===data.message.id)?current:[...current,data.message]);
      if(!active.id&&data.message?.conversationId)setActive((current)=>current?{...current,id:data.message.conversationId,lastMessage:{text:text||"Вложение",createdAt:data.message.createdAt}}:current);
      await loadConversations();
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Нет соединения. Сообщение не отправлено.")}
    finally{setSending(false)}
  }
  function insertEmoji(emoji:string){setDraft((value)=>value+emoji);setEmojiOpen(false)}
  async function startRecording(){
    if(recording)return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});const recorder=new MediaRecorder(stream);
      recordingStreamRef.current=stream;recorderRef.current=recorder;chunksRef.current=[];recordingStartedRef.current=Date.now();setRecordSeconds(0);
      recorder.ondataavailable=(event)=>{if(event.data.size)chunksRef.current.push(event.data)};
      recorder.onstop=()=>{const duration=Math.max(1,Math.round((Date.now()-recordingStartedRef.current)/1000));const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});addFiles([new File([blob],"voice-message.webm",{type:blob.type})],duration);stream.getTracks().forEach((track)=>track.stop());recordingStreamRef.current=null;setRecording(false)};
      recorder.start();setRecording(true);
    }catch{setNotice("Не удалось получить доступ к микрофону.")}
  }
  function stopRecording(){if(recorderRef.current?.state==="recording")recorderRef.current.stop()}
  async function openChat(person:Person){const conversation=conversations.find((item)=>item.other.id===person.id);followLatestRef.current=true;setMessages([]);setNotice("");setProfileVisible(true);setActive(conversation??{id:"",other:person,unread:0,lastMessage:null});setTab("messages")}
  async function joinWaitlist(){const response=await fetch("/api/superflip/purchase",{method:"POST"});const data=await response.json();setNotice(data.message);setSuperflip((value)=>value?{...value,waitlisted:true}:value)}
  const filteredConversations=conversations.filter((item)=>{const q=conversationQuery.trim().toLocaleLowerCase("ru");return !q||item.other.displayName.toLocaleLowerCase("ru").includes(q)||item.other.username.toLocaleLowerCase("ru").includes(q)});

  const friendRows=friendView==="online"?friends.filter((person)=>person.presence==="online"):friendView==="all"?friends:[];
  const content=<section ref={modalRef} tabIndex={embedded?undefined:-1} className={`social-hub social-hub-v2 ${embedded?"social-hub-embedded":""}`} role={embedded?"region":"dialog"} aria-modal={embedded?undefined:true}>
    <aside className="social-nav-rail">
      <div className="social-nav-brand"><small>FLIPZERO SOCIAL</small><strong>Личное</strong></div>
      <label className="social-conversation-search"><Search size={14}/><input value={conversationQuery} onChange={(event)=>setConversationQuery(event.target.value)} placeholder="Поиск диалогов"/></label>
      <button className="social-new-message" onClick={()=>{setTab("friends");setFriendView("add");setActive(null)}}><MessageSquarePlus size={16}/>Новое сообщение</button>
      <button className={tab==="friends"?"active":""} onClick={()=>{setTab("friends");setFriendView("online")}}><Users size={16}/>Друзья{requests.length?<b>{requests.length}</b>:null}</button>
      <button className={tab==="economy"?"active":""} onClick={()=>setTab("economy")}><Star size={16}/>Квесты и монеты</button>
      <button className={tab==="superflip"?"active premium": "premium"} onClick={()=>setTab("superflip")}><Crown size={16}/>SuperFlip</button>
      {isAdmin&&onOpenAdmin?<button className="platform-admin-button" onClick={onOpenAdmin}><ShieldCheck size={16}/>Админ-панель</button>:null}
      <div className="social-dialog-label"><span>Личные сообщения</span><button onClick={()=>{setTab("friends");setFriendView("add")}} aria-label="Новое сообщение" title="Новое сообщение"><UserRoundPlus size={14}/></button></div>
      <div className="social-dialog-list">{filteredConversations.length?filteredConversations.map((item)=><button key={item.id} className={tab==="messages"&&active?.id===item.id?"active":""} onClick={()=>{setTab("messages");setMessages([]);setNotice("");followLatestRef.current=true;setProfileVisible(true);setActive(item)}}><Avatar person={item.other}/><span><strong className={item.other.cosmetics?.nickname?`nick-${item.other.cosmetics.nickname}`:""}>{item.other.displayName}</strong><ClanTag clan={item.other.clan}/><small>{item.lastMessage?.text??"Новый диалог"}</small></span>{item.unread?<b>{item.unread}</b>:null}</button>):<p>Диалогов пока нет.</p>}</div>
    </aside>
    <div className="social-main-v2">
      <header><div><small>{tab==="messages"?"ЛИЧНЫЕ СООБЩЕНИЯ":tab==="friends"?"КОНТАКТЫ":"SUPERFLIP"}</small><h2>{tab==="messages"?(active?.other.displayName??"Сообщения"):tab==="friends"?"Друзья":"SuperFlip"}</h2></div>{onClose?<button onClick={onClose} aria-label="Закрыть"><X size={19}/></button>:null}</header>
      {!loading&&!loadError&&(tab==="messages"||tab==="friends")?<StoryStrip userId={currentUserId}/>:null}
      {loading?<div className="social-loading"><LoaderCircle className="spin"/> Загрузка…</div>:loadError?<div className="social-empty" role="alert"><strong>Не удалось загрузить Social Hub</strong><span>{loadError}</span><button onClick={()=>{setLoading(true);setLoadError("");void loadInitial()}}>Повторить</button></div>
      :tab==="messages"?<><div className={`mobile-direct-list ${active?"is-chat-open":""}`}><label className="mobile-direct-search"><Search size={18}/><input value={conversationQuery} onChange={event=>setConversationQuery(event.target.value)} placeholder="Поиск диалогов" aria-label="Поиск диалогов"/></label><button className="mobile-direct-new" onClick={()=>{setTab("friends");setFriendView("add")}}><MessageSquarePlus size={20}/>Новое сообщение</button><button onClick={()=>{setTab("friends");setFriendView("online")}}><Users size={20}/>Друзья</button><button onClick={()=>setTab("superflip")}><Crown size={20}/>SuperFlip</button>{filteredConversations.length?filteredConversations.map(item=><button key={item.id} className="mobile-direct-row" onClick={()=>{setMessages([]);setNotice("");followLatestRef.current=true;setActive(item)}}><Avatar person={item.other}/><span><strong>{item.other.displayName} <ClanTag clan={item.other.clan}/></strong><small>{item.lastMessage?.text??"Новый диалог"}</small></span><time>{item.lastMessage?.createdAt?new Date(item.lastMessage.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):""}</time>{item.unread?<b aria-label={`Непрочитанных: ${item.unread}`}>{item.unread}</b>:null}</button>):<p>Диалогов пока нет.</p>}</div><div className={`direct-layout social-direct-main ${active?"has-profile":""} ${profileVisible?"profile-visible":"profile-hidden"}`}>
        <section className={dragging?"is-dragging":""} onDragEnter={(event)=>{event.preventDefault();setDragging(true)}} onDragOver={(event)=>event.preventDefault()} onDragLeave={(event)=>{if(event.currentTarget===event.target)setDragging(false)}} onDrop={onDrop}>
          {active?<><ChatLayout className="direct-chat-layout" header={<div className="direct-title"><button type="button" className="direct-mobile-back" aria-label="Назад к диалогам" onClick={()=>{setActive(null);setMessages([]);setMessageCursor(null)}}><ArrowLeft size={19}/></button><button type="button" className="direct-title-profile-trigger" aria-label={`Открыть профиль ${active.other.displayName}`} title="Открыть профиль" onClick={(event)=>{const rect=event.currentTarget.getBoundingClientRect();setProfilePopup({person:active.other,anchor:{x:rect.left,y:rect.bottom+8}})}}><Avatar person={active.other}/></button><span className="direct-title-copy"><strong>{active.other.displayName}</strong><ClanTag clan={active.other.clan}/><small>@{active.other.username}</small></span><div className="direct-actions"><button onClick={()=>setCallMode("voice")} title="Голосовой звонок" aria-label="Голосовой звонок"><Phone size={17}/></button><button onClick={()=>setCallMode("video")} title="Видеозвонок" aria-label="Видеозвонок"><Video size={17}/></button><button onClick={()=>setProfileVisible((value)=>!value)} title={profileVisible?"Скрыть профиль":"Показать профиль"} aria-label={profileVisible?"Скрыть профиль":"Показать профиль"}>{profileVisible?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button></div></div>
          } feed={<><div className="direct-messages" ref={directMessagesRef} onScroll={(event)=>{const list=event.currentTarget;followLatestRef.current=list.scrollHeight-list.scrollTop-list.clientHeight<96;if(list.scrollTop<100&&messageCursor&&!loadingOlder)void loadOlderMessages()}}>{messageCursor?<button type="button" className="direct-load-older" onClick={()=>void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder?<><LoaderCircle className="spin" size={14}/> Загружаем…</>:"Загрузить предыдущие сообщения"}</button>:null}{messages.map((message)=><article key={message.id} className={message.senderId===currentUserId?"mine":""}>{message.clan?<ClanTag clan={message.clan}/>:null}{gameMarker(message.text)?<ChatGameCard id={gameMarker(message.text)!} currentUserId={currentUserId}/>:message.text?<p>{message.text}</p>:null}{message.attachments?.length?<div className="dm-message-attachments">{message.attachments.map((attachment,index)=>attachment.type==="image"?<a key={attachment.url+index} href={attachment.url} target="_blank" rel="noreferrer" className="dm-message-image"><MediaImage src={attachment.url} alt={attachment.name} sizes="320px"/></a>:attachment.type==="audio"?<div key={attachment.url+index} className="dm-message-audio"><Mic size={15}/><audio controls preload="metadata" src={attachment.url}/></div>:<a key={attachment.url+index} className="dm-message-file" href={attachment.url} target="_blank" rel="noreferrer"><FileIcon size={17}/><span><strong>{attachment.name}</strong><small>{Math.ceil(attachment.size/1024)} КБ</small></span></a>)}</div>:null}<time>{new Date(message.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</time></article>)}</div>
          {dragging?<div className="dm-drop-overlay"><FilePlus2 size={34}/><strong>Перетащите файлы сюда</strong><span>До 4 вложений</span></div>:null}</>} composer={<><div className="direct-composer"><ChatComposer value={draft} onChange={setDraft} onSubmit={()=>void sendMessage()} placeholder="Написать сообщение" busy={sending} limit={messageLimit} hasAttachments={pendingFiles.length>0} onFiles={addFiles} onEmoji={()=>setEmojiOpen(value=>!value)} onVoice={recording?stopRecording:()=>void startRecording()} recording={recording} recordingSeconds={recordSeconds} attachmentPreview={pendingFiles.length?<div className="direct-attachment-preview">{pendingFiles.map((item)=><article key={item.id}>{item.previewUrl?<div className="dm-preview-image" style={{backgroundImage:`url("${item.previewUrl}")`}}/>:item.type==="audio"?<Mic size={22}/>:<FileIcon size={22}/>}<span><strong>{item.file.name}</strong><small>{Math.ceil(item.file.size/1024)} КБ{item.duration?` · ${item.duration} сек.`:""}</small></span><button type="button" onClick={()=>removePending(item.id)} aria-label="Удалить вложение"><X size={14}/></button></article>)}</div>:null} accessory={emojiOpen?<div className="direct-emoji-picker">{quickEmoji.map((emoji)=><button type="button" key={emoji} onClick={()=>insertEmoji(emoji)}>{emoji}</button>)}</div>:null}/></div>{notice?<p className="direct-notice" role="alert">{notice}</p>:null}</>} /></>:<div className="social-empty"><MessageCircle size={32}/><strong>Выберите диалог</strong><span>Выберите собеседника слева или создайте новое сообщение.</span><button onClick={()=>{setTab("friends");setFriendView("add")}}>Новое сообщение</button></div>}</section>
        {active&&profileVisible?<DirectProfile key={active.other.id} person={active.other} onClose={()=>setProfileVisible(false)}/>:null}
        {active&&callMode?<DirectCallOverlay person={active.other} video={callMode==="video"} onClose={()=>setCallMode(null)}/>:null}
      </div></>
      :tab==="friends"?<div className="friends-hub-v2">
        <nav className="friends-tabs"><button className={friendView==="online"?"active":""} onClick={()=>setFriendView("online")}><UserCheck size={15}/>В сети</button><button className={friendView==="all"?"active":""} onClick={()=>setFriendView("all")}><Users size={15}/>Все</button><button className={friendView==="pending"?"active":""} onClick={()=>setFriendView("pending")}><Clock3 size={15}/>Ожидание{requests.length+outgoingRequests.length?<b>{requests.length+outgoingRequests.length}</b>:null}</button><button className={friendView==="blocked"?"active":""} onClick={()=>setFriendView("blocked")}><Ban size={15}/>Заблокированные</button><button className={friendView==="add"?"active add": "add"} onClick={()=>setFriendView("add")}><UserPlus size={15}/>Добавить в друзья</button></nav>
        {notice?<p className="social-notice">{notice}</p>:null}
        {friendView==="add"?<div className="friend-add-panel"><h3>Добавить в друзья</h3><p>Найдите пользователя по username и отправьте запрос.</p><form className="friend-search" onSubmit={search}><Search size={16}/><input name="q" minLength={2} placeholder="Введите username"/><button>Найти</button></form>{results.length?<section><h3>Результаты</h3>{results.map((person)=><FriendRow key={person.id} person={person} onProfile={(anchor)=>setProfilePopup({person,anchor})} actions={<><button className="icon" aria-label="Написать сообщение" title="Написать сообщение" onClick={()=>void openChat(person)}><MessageCircle size={16}/></button><button className="icon" aria-label="Добавить в друзья" title="Добавить в друзья" onClick={()=>void requestFriend(person.id)}><UserPlus size={16}/></button></>}/>)}</section>:null}</div>
        :friendView==="pending"?<div className="friend-list-v2">{requests.map((item)=><FriendRow key={"in:"+item.id} person={item.from} onProfile={(anchor)=>setProfilePopup({person:item.from,anchor})} subtitle="Хочет добавить вас в друзья" actions={<><button className="icon positive" aria-label="Принять" title="Принять" onClick={()=>void respond(item.id,"accepted")}><UserCheck size={16}/></button><button className="icon danger" aria-label="Отклонить" title="Отклонить" onClick={()=>void respond(item.id,"declined")}><X size={16}/></button></>}/>)}{outgoingRequests.map((item)=><FriendRow key={"out:"+item.id} person={item.to} onProfile={(anchor)=>setProfilePopup({person:item.to,anchor})} subtitle="Исходящая заявка" actions={<button className="icon danger" aria-label="Отменить заявку" title="Отменить заявку" onClick={()=>void cancelFriendRequest(item.id)}><X size={16}/></button>}/>)}{!requests.length&&!outgoingRequests.length?<EmptyFriends title="Нет ожидающих заявок" text="Входящие и исходящие заявки появятся здесь."/>:null}</div>
        :friendView==="blocked"?<div className="friend-list-v2">{blocked.length?blocked.map((person)=><FriendRow key={person.id} person={person} onProfile={(anchor)=>setProfilePopup({person,anchor})} subtitle="Заблокирован" actions={<button className="icon" aria-label="Разблокировать" title="Разблокировать" onClick={()=>void unblock(person.id)}><ShieldCheck size={16}/></button>}/>):<EmptyFriends title="Список блокировок пуст" text="Заблокированные пользователи появятся здесь."/>}</div>
        :<div className="friend-list-v2">{friendRows.length?friendRows.map((person)=><FriendRow key={person.id} person={person} onProfile={(anchor)=>setProfilePopup({person,anchor})} subtitle={person.presence==="online"?"В сети":"Не в сети"} actions={<><button className="icon" aria-label="Написать сообщение" title="Написать сообщение" onClick={()=>void openChat(person)}><MessageCircle size={16}/></button><button className="icon danger" aria-label="Удалить из друзей" title="Удалить из друзей" onClick={()=>void removeFriend(person.id)}><X size={16}/></button></>}/>):<EmptyFriends title={friendView==="online"?"Сейчас никто из друзей не в сети":"Список друзей пуст"} text={friendView==="online"?"Когда друзья появятся в сети, они будут здесь.":"Добавьте пользователя по username."}/>}</div>}
      </div>
      :tab==="economy"?<PersonalEconomy/>
      :<div className="superflip-panel superflip-panel-v2"><span className="superflip-icon"><Crown size={34}/></span><small>{superflip?.status==="active"?"SUPERFLIP АКТИВЕН":superflip?.status==="trial_active"?"ПОДАРОЧНЫЙ SUPERFLIP":superflip?.status==="expired"?"SUPERFLIP ЗАВЕРШЁН":"SUPERFLIP: СКОРО"}</small><h3>{superflip?.active?"Ваши расширенные возможности включены":"Больше возможностей. Больше вашего стиля."}</h3><p>{superflip?.active?"Используйте увеличенные лимиты профиля, медиа и личных сообщений.":"SuperFlip расширяет личное общение и оформление профиля без изменения привычного интерфейса."}</p><div className="superflip-benefit-grid"><article><MessageCircle/><strong>4000 символов</strong><span>Личные сообщения вместо 1000 в Free.</span></article><article><Star/><strong>Профиль до 500</strong><span>Больше места для описания и персонализации.</span></article><article><ImageIcon/><strong>Баннер до 16 МБ</strong><span>Больше качества для оформления профиля.</span></article><article><Zap/><strong>Анимированные медиа</strong><span>Расширенные возможности аватара и баннера.</span></article><article><Star/><strong>Бонус к наградам</strong><span>На 20% больше XP и монет за квесты.</span></article><article><Crown/><strong>5 бейджей</strong><span>Расширенная витрина достижений вместо 3.</span></article><article><Sparkles/><strong>Эксклюзивы</strong><span>Особые предметы в магазине косметики.</span></article></div>{superflip?.source==="gift"&&superflip.reason?<div className="superflip-gift-reason" role="note"><span><Crown size={14}/> ПРИЧИНА ПОДАРКА</span><strong>{superflip.reason}</strong><small>{superflip.grantedAt?`Выдан ${new Date(superflip.grantedAt).toLocaleString("ru-RU",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}`:"Подарочный доступ SuperFlip"}</small></div>:null}{superflip?.active?<button disabled>SuperFlip активен{superflip.expiresAt?` до ${new Date(superflip.expiresAt).toLocaleDateString("ru-RU")}`:""}</button>:<button onClick={joinWaitlist} disabled={superflip?.waitlisted}>{superflip?.waitlisted?"Вы в листе ожидания":"Подключить SuperFlip"}</button>}{notice?<p className="social-notice">{notice}</p>:null}</div>}
    </div>
    {profilePopup?<UserProfilePopover key={profilePopup.person.id} userId={profilePopup.person.id} displayName={profilePopup.person.displayName} anchor={profilePopup.anchor} onClose={()=>setProfilePopup(null)} onOpenDirect={(userId)=>{const person=[...friends,...conversations.map((item)=>item.other),...results].find((item)=>item.id===userId)??profilePopup.person;setProfilePopup(null);void openChat(person)}}/>:null}
  </section>;
  return embedded?content:<div className="dialog-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&onClose?.()}>{content}</div>;
}

function FriendRow({person,subtitle,actions,onProfile}:{person:Person;subtitle?:string;actions:ReactNode;onProfile:(anchor:{x:number;y:number})=>void}){return <article className="friend-row-v2"><button type="button" className="friend-profile-trigger" onClick={(event)=>{const rect=event.currentTarget.getBoundingClientRect();onProfile({x:rect.left,y:rect.bottom+6})}} aria-label={`Открыть профиль ${person.displayName}`}><Avatar person={person}/><span><strong className={person.cosmetics?.nickname?`nick-${person.cosmetics.nickname}`:""}>{person.displayName}</strong><ClanTag clan={person.clan}/><small>@{person.username}{person.globalLevel?` · уровень ${person.globalLevel}`:""} · {subtitle??(person.presence==="online"?"В сети":"Не в сети")}</small></span></button><div className="friend-row-actions">{actions}</div></article>}
function EmptyFriends({title,text}:{title:string;text:string}){return <div className="social-empty friend-empty"><Users size={28}/><strong>{title}</strong><span>{text}</span></div>}
function Avatar({person}:{person:Person}){return <i className={`social-avatar frame-${person.cosmetics?.avatar_frame??"none"}`}>{person.avatarUrl?<MediaImage src={person.avatarUrl}/>:person.displayName.slice(0,2).toUpperCase()}</i>}

function DirectProfile({person,onClose}:{person:Person;onClose:()=>void}){
  const [details,setDetails]=useState<ProfileDetails|null>(null);
  const [profileError,setProfileError]=useState(false);
  const [commonTab,setCommonTab]=useState<"friends"|"servers">("friends");
  useEffect(()=>{
    let cancelled=false;
    const load=()=>void fetch(`/api/v1/users/${person.id}/profile`,{cache:"no-store"}).then(async(response)=>response.ok?response.json():null).then((data)=>{if(!cancelled){setDetails(data?.profile??null);setProfileError(!data?.profile)}}).catch(()=>{if(!cancelled){setDetails(null);setProfileError(true)}});
    load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")load()},15000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[person.id]);
  const displayName=details?.displayName??person.displayName;
  const username=details?.username??person.username;
  const avatarUrl=details?.avatarUrl??person.avatarUrl;
  const isOnline=(details?.presence??person.presence)==="online";
  const avatarPerson={...person,displayName,username,avatarUrl};
  return <aside className="direct-profile profile-reference" aria-label={`Профиль ${displayName}`}>
    <button className="direct-profile-close" type="button" onClick={onClose} aria-label="Скрыть профиль"><X size={17}/></button>
    <div className="direct-profile-cover" style={details?.bannerUrl?{backgroundImage:`linear-gradient(180deg,transparent,#07101d),url("${details.bannerUrl}")`}:undefined}><span>FLIPZERO</span></div>
    <div className="direct-profile-identity"><Avatar person={avatarPerson}/><span className={`direct-presence ${isOnline?"online":""}`}/><h3>{displayName}</h3><ClanTag clan={details?.clan??person.clan}/><p>@{username}</p><small>{isOnline?"● В сети":"Не в сети"}</small></div>
    <section className="profile-reference-about"><h4>О пользователе</h4><p>{profileError?"Не удалось загрузить профиль.":details?.bio||"Пользователь пока ничего о себе не рассказал."}</p>{details?.profileStatus?<span>{details.profileStatus}</span>:null}{details?.profileLocation?<span><MapPin size={15}/>{details.profileLocation}</span>:null}</section>
    {details?.id===person.id?<section className="profile-reference-stats"><h4>Статистика</h4><div><span><Star size={16}/><b>{details.globalLevel}</b><small>Уровень</small></span><span><MessageCircle size={16}/><b>{details.stats.messages}</b><small>Сообщений</small></span><span><Users size={16}/><b>{details.stats.servers}</b><small>Пространств</small></span><span><Users size={16}/><b>{details.stats.friends}</b><small>Друзей</small></span></div></section>:null}
    {details?<section className="direct-common"><div className="direct-common-tabs"><button className={commonTab==="friends"?"active":""} onClick={()=>setCommonTab("friends")}>Общие друзья <b>{details.commonFriends?.length??0}</b></button><button className={commonTab==="servers"?"active":""} onClick={()=>setCommonTab("servers")}>Общие серверы <b>{details.commonServers?.length??0}</b></button></div>{commonTab==="friends"?<div className="direct-common-list">{details.commonFriends?.length?details.commonFriends.map((friend)=><span key={friend.id}><i>{friend.avatarUrl?<MediaImage src={friend.avatarUrl}/>:friend.displayName.slice(0,2)}</i><strong>{friend.displayName}</strong><small>@{friend.username}</small></span>):<p>Общих друзей пока нет.</p>}</div>:<div className="direct-common-list">{details.commonServers?.length?details.commonServers.map((server)=><span key={server.id}><i>{server.iconUrl?<MediaImage src={server.iconUrl}/>:server.name.slice(0,2)}</i><strong>{server.name}</strong></span>):<p>Общих серверов пока нет.</p>}</div>}</section>:null}
  </aside>;
}
