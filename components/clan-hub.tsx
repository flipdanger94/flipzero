"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, Ban, Check, CheckCircle2, Crown, Ellipsis, File as FileIcon, FilePlus2, Image as ImageIcon,
  LoaderCircle, LogOut, MessageCircle, Search, SendHorizontal, Settings2, Shield, ShieldCheck, Smile,
  Swords, UserMinus, UserPlus, Users, X,
} from "lucide-react";
import { MediaImage } from "./media-image";
import { UserProfilePopover } from "./user-profile-popover";
import { ConfirmDialog } from "./action-dialogs";

type ClanRole="leader"|"officer"|"member";
type JoinType="open"|"application"|"closed";
type Clan={
  id:string;name:string;tag:string;description:string|null;avatarUrl:string|null;bannerUrl:string|null;
  joinType:JoinType;memberCount:number;leaderId:string;createdAt:string;
};
type DiscoveryClan=Clan&{full:boolean;pendingRequest:{id:string;kind:"application"|"invite";status:string}|null};
type Member={userId:string;username:string;displayName:string;avatarUrl:string|null;presence:string;globalLevel:number;globalXp:number;role:ClanRole;joinedAt:string};
type ClanRequest={id:string;userId:string;kind:"application"|"invite";status:string;createdAt:string;username:string;displayName:string;avatarUrl:string|null;globalLevel:number};
type Attachment={type:"image"|"audio"|"file";url:string;name:string;mimeType:string;size:number;duration?:number};
type ClanMessage={id:string;clanId:string;authorId:string;content:string;attachments:Attachment[];createdAt:string;editedAt:string|null;username:string;displayName:string;avatarUrl:string|null;globalLevel:number};
type Detail={clan:Clan;role:ClanRole;members:Member[];requests:ClanRequest[];permissions:{moderate:boolean;manage:boolean}};
type PendingFile={id:string;file:File;previewUrl:string|null};
type Tab="chat"|"members"|"requests"|"settings";

const roleLabel:Record<ClanRole,string>={leader:"Лидер",officer:"Офицер",member:"Участник"};
const joinTypeLabel:Record<JoinType,string>={open:"Открытый",application:"По заявке",closed:"По приглашению"};
const quickEmoji=["😀","😂","😍","😎","🤔","😭","🙏","👍","❤️","🔥","✨","🎉","⚔️","🛡️","🏆","💜"];

export function ClanHub({currentUserId,onOpenDirect}:{currentUserId:string;onOpenDirect?:(userId:string)=>void}) {
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<DiscoveryClan[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [tab,setTab]=useState<Tab>("chat");
  const [createOpen,setCreateOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [messages,setMessages]=useState<ClanMessage[]>([]);
  const [draft,setDraft]=useState("");
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [pendingFiles,setPendingFiles]=useState<PendingFile[]>([]);
  const [messageLimit,setMessageLimit]=useState(1000);
  const [memberMenu,setMemberMenu]=useState<string|null>(null);
  const [profileUser,setProfileUser]=useState<Member|null>(null);
  const [confirm,setConfirm]=useState<{kind:"leave"|"delete"|"kick"|"transfer";member?:Member}|null>(null);
  const [inviteUsername,setInviteUsername]=useState("");
  const [createAvatar,setCreateAvatar]=useState<File|null>(null);
  const [createBanner,setCreateBanner]=useState<File|null>(null);
  const messagesRef=useRef<HTMLDivElement|null>(null);
  const eventSourceRef=useRef<EventSource|null>(null);

  const loadState=useCallback(async(search="")=>{
    setError("");
    const response=await fetch(`/api/v1/clans?q=${encodeURIComponent(search)}`,{cache:"no-store"});
    const data=await response.json().catch(()=>null);
    if(!response.ok){setError(data?.message??"Не удалось загрузить кланы.");setLoading(false);return;}
    if(data.membership?.clanId){
      const detailResponse=await fetch(`/api/v1/clans/${data.membership.clanId}`,{cache:"no-store"});
      const detailData=await detailResponse.json().catch(()=>null);
      if(detailResponse.ok){setDetail(detailData);setResults([]);}
      else setError(detailData?.message??"Не удалось загрузить клан.");
    }else{
      setDetail(null);setResults(data.clans??[]);
    }
    setLoading(false);
  },[]);

  const loadMessages=useCallback(async(clanId:string)=>{
    const response=await fetch(`/api/v1/clans/${clanId}/messages`,{cache:"no-store"});
    const data=await response.json().catch(()=>null);
    if(response.ok){
      setMessages(data.messages??[]);
      requestAnimationFrame(()=>{const node=messagesRef.current;if(node)node.scrollTop=node.scrollHeight;});
    }else if(response.status===403){setDetail(null);setError(data?.message??"Доступ к клану закрыт.");}
  },[]);

  useEffect(()=>{
    void Promise.all([
      loadState(),
      fetch("/api/superflip/status",{cache:"no-store"}).then(r=>r.json()).then(d=>setMessageLimit(d.capabilities?.directMessageLimit??1000)).catch(()=>{}),
    ]);
  },[loadState]);

  useEffect(()=>{
    eventSourceRef.current?.close();
    if(!detail?.clan.id||tab!=="chat") return;
    void loadMessages(detail.clan.id);
    const source=new EventSource(`/api/v1/clans/${detail.clan.id}/events`);
    eventSourceRef.current=source;
    let syncTimer:number|undefined;
    source.addEventListener("sync",()=>{window.clearTimeout(syncTimer);syncTimer=window.setTimeout(()=>void loadMessages(detail.clan.id),220)});
    source.addEventListener("revoked",()=>{source.close();setDetail(null);setError("Доступ к клану больше недоступен.");});
    return()=>{window.clearTimeout(syncTimer);source.close();eventSourceRef.current=null};
  },[detail?.clan.id,tab,loadMessages]);

  useEffect(()=>()=>{eventSourceRef.current?.close()},[]);

  const canModerate=detail?.permissions.moderate??false;
  const canManage=detail?.permissions.manage??false;
  const overLimit=draft.length>messageLimit;

  async function search(event?:FormEvent){
    event?.preventDefault();setLoading(true);await loadState(query.trim());
  }

  async function joinClan(clan:DiscoveryClan,action:"join"|"apply"|"accept_invite"|"decline_invite"){
    if(busy)return;setBusy(true);setNotice("");
    const requestId=clan.pendingRequest?.id;
    const response=await fetch(`/api/v1/clans/${clan.id}/membership`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,requestId})});
    const data=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setNotice(data?.message??"Не удалось выполнить действие.");return;}
    setNotice(action==="apply"?"Заявка отправлена.":action==="decline_invite"?"Приглашение отклонено.":"Готово.");
    await loadState(query);
  }

  async function uploadClanImage(clanId:string,kind:"clanAvatar"|"clanBanner",file:File){
    const form=new FormData();form.append("kind",kind);form.append("clanId",clanId);form.append("file",file);
    const response=await fetch("/api/v1/media",{method:"POST",body:form});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.message??"Не удалось загрузить изображение.");
  }

  async function createClan(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setNotice("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/v1/clans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      name:form.get("name"),tag:form.get("tag"),description:form.get("description"),joinType:form.get("joinType"),
    })});
    const data=await response.json().catch(()=>null);
    if(!response.ok){setBusy(false);setNotice(data?.message??"Не удалось создать клан.");return;}
    try{
      if(createAvatar)await uploadClanImage(data.clan.id,"clanAvatar",createAvatar);
      if(createBanner)await uploadClanImage(data.clan.id,"clanBanner",createBanner);
      setCreateOpen(false);setCreateAvatar(null);setCreateBanner(null);setNotice("Клан создан.");
      await loadState();
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Клан создан, но оформление не загрузилось.");await loadState();}
    finally{setBusy(false)}
  }

  function addFiles(files:File[]){
    setPendingFiles(current=>{
      const available=Math.max(0,4-current.length);
      return [...current,...files.slice(0,available).map(file=>({id:crypto.randomUUID(),file,previewUrl:file.type.startsWith("image/")?URL.createObjectURL(file):null}))];
    });
  }
  function removeFile(id:string){setPendingFiles(current=>{const target=current.find(item=>item.id===id);if(target?.previewUrl)URL.revokeObjectURL(target.previewUrl);return current.filter(item=>item.id!==id)})}
  async function uploadAttachment(item:PendingFile){
    const form=new FormData();form.append("file",item.file);
    const response=await fetch("/api/messages/attachments",{method:"POST",body:form});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.message??"Не удалось загрузить вложение.");
    return data.attachment as Attachment;
  }

  async function sendMessage(event:FormEvent){
    event.preventDefault();if(!detail||busy||overLimit)return;
    const content=draft.trim();if(!content&&!pendingFiles.length)return;
    setBusy(true);setNotice("");
    try{
      const attachments=await Promise.all(pendingFiles.map(uploadAttachment));
      const response=await fetch(`/api/v1/clans/${detail.clan.id}/messages`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content,attachments})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.message??"Не удалось отправить сообщение.");
      pendingFiles.forEach(file=>file.previewUrl&&URL.revokeObjectURL(file.previewUrl));setPendingFiles([]);setDraft("");setEmojiOpen(false);
      setMessages(current=>[...current,data.message]);
      requestAnimationFrame(()=>{const node=messagesRef.current;if(node)node.scrollTop=node.scrollHeight});
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Не удалось отправить сообщение.")}
    finally{setBusy(false)}
  }

  async function reloadDetail(){
    if(!detail)return;
    const response=await fetch(`/api/v1/clans/${detail.clan.id}`,{cache:"no-store"});
    const data=await response.json().catch(()=>null);
    if(response.ok)setDetail(data);else{setDetail(null);setError(data?.message??"Доступ к клану закрыт.")}
  }

  async function decideRequest(requestId:string,decision:"accept"|"decline"){
    if(!detail||busy)return;setBusy(true);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}/requests`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({requestId,decision})});
    const data=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setNotice(data?.message??"Не удалось обработать заявку.");return;}
    setNotice(decision==="accept"?"Заявка принята.":"Заявка отклонена.");await reloadDetail();
  }

  async function invite(event:FormEvent){
    event.preventDefault();if(!detail||busy||!inviteUsername.trim())return;setBusy(true);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}/membership`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"invite",username:inviteUsername.trim()})});
    const data=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setNotice(data?.message??"Не удалось отправить приглашение.");return;}
    setInviteUsername("");setNotice("Приглашение отправлено.");await reloadDetail();
  }

  async function memberAction(member:Member,action:"promote"|"demote"|"kick"|"transfer"){
    if(!detail||busy)return;setBusy(true);setMemberMenu(null);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}/membership`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action,userId:member.userId})});
    const data=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setNotice(data?.message??"Не удалось выполнить действие.");return;}
    setNotice(action==="transfer"?"Лидерство передано.":"Изменения сохранены.");await reloadDetail();
  }

  async function leaveClan(){
    if(!detail)return;setBusy(true);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}/membership`,{method:"DELETE"});
    const data=await response.json().catch(()=>null);setBusy(false);setConfirm(null);
    if(!response.ok){setNotice(data?.message??"Не удалось покинуть клан.");return;}
    setDetail(null);setMessages([]);setNotice("Вы покинули клан.");await loadState();
  }

  async function deleteClan(){
    if(!detail)return;setBusy(true);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({name:detail.clan.name})});
    const data=await response.json().catch(()=>null);setBusy(false);setConfirm(null);
    if(!response.ok){setNotice(data?.message??"Не удалось удалить клан.");return;}
    setDetail(null);setMessages([]);setNotice("Клан удалён.");await loadState();
  }

  async function saveSettings(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!detail||busy)return;setBusy(true);
    const form=new FormData(event.currentTarget);
    const response=await fetch(`/api/v1/clans/${detail.clan.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({
      name:form.get("name"),tag:form.get("tag"),description:form.get("description"),joinType:form.get("joinType"),
    })});
    const data=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setNotice(data?.message??"Не удалось сохранить настройки.");return;}
    setNotice("Настройки клана сохранены.");await reloadDetail();
  }

  async function updateClanMedia(kind:"clanAvatar"|"clanBanner",file:File|null){
    if(!detail||!file)return;setBusy(true);
    try{await uploadClanImage(detail.clan.id,kind,file);setNotice("Оформление обновлено.");await reloadDetail();}
    catch(reason){setNotice(reason instanceof Error?reason.message:"Не удалось обновить оформление.")}
    finally{setBusy(false)}
  }

  const sortedMembers=useMemo(()=>detail?[...detail.members].sort((a,b)=>{
    const rank=(role:ClanRole)=>role==="leader"?0:role==="officer"?1:2;
    return rank(a.role)-rank(b.role)||a.displayName.localeCompare(b.displayName,"ru");
  }):[],[detail]);

  if(loading)return <section className="clan-hub"><div className="clan-state"><LoaderCircle className="spin" size={28}/><strong>Загружаем кланы…</strong></div></section>;

  return <section className="clan-hub">
    <header className="clan-hub-header"><div><small>FLIPZERO CLANS</small><h2>{detail?detail.clan.name:"Кланы"}</h2><p>{detail?`[${detail.clan.tag}] · ${roleLabel[detail.role]}`:"Создавайте команды, общайтесь и развивайте своё сообщество."}</p></div>{detail?<span className="clan-role-pill"><Shield size={14}/>{roleLabel[detail.role]}</span>:null}</header>
    {notice?<div className="clan-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Закрыть уведомление"><X size={15}/></button></div>:null}
    {error?<div className="clan-error" role="alert">{error}</div>:null}

    {!detail?<div className="clan-discovery">
      <div className="clan-discovery-toolbar"><form onSubmit={search}><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Поиск по названию или тегу"/><button>Найти</button></form><button className="clan-primary" onClick={()=>setCreateOpen(true)}><UserPlus size={16}/>Создать клан</button></div>
      <div className="clan-grid">{results.length?results.map(clan=><article className="clan-card" key={clan.id}>
        <div className="clan-card-banner" style={clan.bannerUrl?{backgroundImage:`linear-gradient(180deg,transparent,#0a1120),url("${clan.bannerUrl}")`}:undefined}/>
        <div className="clan-card-body"><span className="clan-card-avatar">{clan.avatarUrl?<MediaImage src={clan.avatarUrl}/>:clan.tag.slice(0,2)}</span><div className="clan-card-title"><strong>{clan.name}</strong><span>[{clan.tag}]</span></div><p>{clan.description||"Описание клана пока не заполнено."}</p><div className="clan-card-meta"><span><Users size={14}/>{clan.memberCount}/50</span><span><ShieldCheck size={14}/>{joinTypeLabel[clan.joinType]}</span></div>
          <div className="clan-card-actions">{clan.full?<button disabled>Клан заполнен</button>:clan.pendingRequest?.kind==="invite"?<><button className="clan-primary" disabled={busy} onClick={()=>void joinClan(clan,"accept_invite")}>Принять приглашение</button><button disabled={busy} onClick={()=>void joinClan(clan,"decline_invite")}>Отклонить</button></>:clan.pendingRequest?.kind==="application"?<button disabled>Заявка отправлена</button>:clan.joinType==="open"?<button className="clan-primary" disabled={busy} onClick={()=>void joinClan(clan,"join")}>Вступить</button>:clan.joinType==="application"?<button className="clan-primary" disabled={busy} onClick={()=>void joinClan(clan,"apply")}>Подать заявку</button>:<button disabled>Только по приглашению</button>}</div>
        </div>
      </article>):<div className="clan-empty"><Swords size={34}/><strong>Кланы не найдены</strong><span>{query?"Попробуйте изменить запрос.":"Создайте первый клан или найдите подходящий по названию."}</span><button className="clan-primary" onClick={()=>setCreateOpen(true)}>Создать клан</button></div>}</div>
    </div>:<div className="clan-member-view">
      <div className="clan-hero" style={detail.clan.bannerUrl?{backgroundImage:`linear-gradient(180deg,rgba(5,8,18,.15),#07101f 92%),url("${detail.clan.bannerUrl}")`}:undefined}>
        <span className="clan-hero-avatar">{detail.clan.avatarUrl?<MediaImage src={detail.clan.avatarUrl}/>:detail.clan.tag.slice(0,2)}</span>
        <div><small>[{detail.clan.tag}]</small><h3>{detail.clan.name}</h3><p>{detail.clan.description||"Описание клана пока не заполнено."}</p><div><span><Users size={14}/>{detail.clan.memberCount}/50</span><span><ShieldCheck size={14}/>{joinTypeLabel[detail.clan.joinType]}</span></div></div>
        {detail.role!=="leader"?<button className="clan-danger-ghost" onClick={()=>setConfirm({kind:"leave"})}><LogOut size={15}/>Покинуть клан</button>:null}
      </div>
      <nav className="clan-tabs"><button className={tab==="chat"?"active":""} onClick={()=>setTab("chat")}><MessageCircle size={16}/>Клановый чат</button><button className={tab==="members"?"active":""} onClick={()=>setTab("members")}><Users size={16}/>Участники</button>{canModerate?<button className={tab==="requests"?"active":""} onClick={()=>setTab("requests")}><BadgeCheck size={16}/>Заявки{detail.requests.length?<b>{detail.requests.length}</b>:null}</button>:null}{canManage?<button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings2 size={16}/>Настройки клана</button>:null}</nav>

      {tab==="chat"?<div className="clan-chat">
        <div className="clan-message-list" ref={messagesRef}>{messages.length?messages.map(message=><article key={message.id} className={message.authorId===currentUserId?"mine":""}><button type="button" className="clan-message-avatar" onClick={()=>{const member=detail.members.find(item=>item.userId===message.authorId);if(member)setProfileUser(member)}} aria-label={`Открыть профиль ${message.displayName}`}>{message.avatarUrl?<MediaImage src={message.avatarUrl}/>:message.displayName.slice(0,2)}</button><div><header><strong>{message.displayName}</strong><span>LVL {message.globalLevel}</span><time>{new Date(message.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</time></header>{message.content?<p>{message.content}</p>:null}{message.attachments?.length?<div className="clan-message-attachments">{message.attachments.map((attachment,index)=>attachment.type==="image"?<a key={attachment.url+index} href={attachment.url} target="_blank" rel="noreferrer"><MediaImage src={attachment.url} alt={attachment.name}/></a>:<a key={attachment.url+index} href={attachment.url} target="_blank" rel="noreferrer"><FileIcon size={16}/><span>{attachment.name}</span></a>)}</div>:null}</div></article>):<div className="clan-empty clan-chat-empty"><MessageCircle size={32}/><strong>Начните разговор</strong><span>Первое сообщение клана появится здесь.</span></div>}</div>
        <form className="clan-composer" onSubmit={sendMessage}>{pendingFiles.length?<div className="clan-attachment-preview">{pendingFiles.map(item=><span key={item.id}>{item.previewUrl?<i style={{backgroundImage:`url("${item.previewUrl}")`}}/>:<FileIcon size={18}/>}<b>{item.file.name}</b><button type="button" onClick={()=>removeFile(item.id)} aria-label="Удалить вложение"><X size={13}/></button></span>)}</div>:null}<div><label className="clan-file-button" title="Добавить вложение" aria-label="Добавить вложение"><FilePlus2 size={18}/><input type="file" multiple hidden accept="image/*,.pdf,.txt,.zip,audio/*" onChange={event=>{addFiles([...(event.currentTarget.files??[])]);event.currentTarget.value=""}}/></label><textarea value={draft} onChange={event=>setDraft(event.target.value)} rows={1} placeholder="Сообщение в клановый чат" aria-invalid={overLimit}/><button type="button" onClick={()=>setEmojiOpen(value=>!value)} aria-label="Эмодзи" title="Эмодзи"><Smile size={18}/></button><button className="clan-send" disabled={busy||overLimit||(!draft.trim()&&!pendingFiles.length)} aria-label="Отправить"><SendHorizontal size={18}/></button></div><footer><span>{messageLimit===4000?"SuperFlip · 4000 символов":"Free · 1000 символов"}</span><b className={overLimit?"over":""}>{draft.length}/{messageLimit}</b></footer>{emojiOpen?<div className="clan-emoji-picker">{quickEmoji.map(emoji=><button type="button" key={emoji} onClick={()=>{setDraft(value=>value+emoji);setEmojiOpen(false)}}>{emoji}</button>)}</div>:null}</form>
      </div>:null}

      {tab==="members"?<div className="clan-members-tab">{canModerate?<form className="clan-invite-form" onSubmit={invite}><UserPlus size={16}/><input value={inviteUsername} onChange={event=>setInviteUsername(event.target.value)} placeholder="Username для приглашения"/><button disabled={busy||!inviteUsername.trim()}>Пригласить</button></form>:null}<div className="clan-member-list">{sortedMembers.map(member=><article key={member.userId}><button className="clan-member-main" type="button" onClick={()=>setProfileUser(member)}><span className="clan-member-avatar">{member.avatarUrl?<MediaImage src={member.avatarUrl}/>:member.displayName.slice(0,2)}<i className={member.presence==="online"?"online":""}/></span><span><strong>{member.displayName}</strong><small>@{member.username} · уровень {member.globalLevel}</small></span></button><span className={`clan-member-role role-${member.role}`}>{roleLabel[member.role]}</span>{member.userId!==currentUserId&&canModerate&&member.role!=="leader"?<div className="clan-member-menu-wrap"><button className="clan-member-menu-button" onClick={()=>setMemberMenu(memberMenu===member.userId?null:member.userId)} aria-label="Действия с участником" title="Действия с участником"><Ellipsis size={18}/></button>{memberMenu===member.userId?<div className="clan-member-menu">{canManage&&member.role==="member"?<button onClick={()=>void memberAction(member,"promote")}><ShieldCheck size={14}/>Назначить офицером</button>:null}{canManage&&member.role==="officer"?<button onClick={()=>void memberAction(member,"demote")}><Shield size={14}/>Понизить до участника</button>:null}{canManage?<button onClick={()=>setConfirm({kind:"transfer",member})}><Crown size={14}/>Передать лидерство</button>:null}{(detail.role==="leader"||member.role==="member")?<><i/><button className="danger" onClick={()=>setConfirm({kind:"kick",member})}><UserMinus size={14}/>Исключить</button></>:null}</div>:null}</div>:null}</article>)}</div></div>:null}

      {tab==="requests"&&canModerate?<div className="clan-requests-tab"><form className="clan-invite-form" onSubmit={invite}><UserPlus size={16}/><input value={inviteUsername} onChange={event=>setInviteUsername(event.target.value)} placeholder="Username для приглашения"/><button disabled={busy||!inviteUsername.trim()}>Пригласить</button></form>{detail.requests.filter(request=>request.kind==="application").length?detail.requests.filter(request=>request.kind==="application").map(request=><article className="clan-request-card" key={request.id}><span className="clan-member-avatar">{request.avatarUrl?<MediaImage src={request.avatarUrl}/>:request.displayName.slice(0,2)}</span><div><strong>{request.displayName}</strong><small>@{request.username} · уровень {request.globalLevel}</small><time>{new Date(request.createdAt).toLocaleString("ru-RU")}</time></div><button className="positive" onClick={()=>void decideRequest(request.id,"accept")} aria-label="Принять заявку" title="Принять"><CheckCircle2 size={17}/></button><button className="danger" onClick={()=>void decideRequest(request.id,"decline")} aria-label="Отклонить заявку" title="Отклонить"><X size={17}/></button></article>):<div className="clan-empty"><BadgeCheck size={31}/><strong>Новых заявок нет</strong><span>Заявки на вступление появятся здесь.</span></div>}</div>:null}

      {tab==="settings"&&canManage?<div className="clan-settings-tab"><form className="clan-settings-form" onSubmit={saveSettings}><label><span>Название</span><input name="name" defaultValue={detail.clan.name} minLength={3} maxLength={32} required/></label><label><span>Тег</span><input name="tag" defaultValue={detail.clan.tag} minLength={2} maxLength={5} required/></label><label className="wide"><span>Описание</span><textarea name="description" rows={4} maxLength={500} defaultValue={detail.clan.description??""}/></label><label><span>Тип вступления</span><select name="joinType" defaultValue={detail.clan.joinType}><option value="open">Открытый</option><option value="application">По заявке</option><option value="closed">По приглашению</option></select></label><div className="wide clan-settings-actions"><button className="clan-primary" disabled={busy}>Сохранить настройки</button></div></form><div className="clan-media-settings"><label><ImageIcon size={17}/>Аватар клана<input type="file" accept="image/*" onChange={event=>void updateClanMedia("clanAvatar",event.target.files?.[0]??null)}/></label><label><ImageIcon size={17}/>Баннер клана<input type="file" accept="image/*" onChange={event=>void updateClanMedia("clanBanner",event.target.files?.[0]??null)}/></label></div><div className="clan-danger-zone"><strong>Опасная зона</strong><p>Удаление клана необратимо. Будут удалены участники, заявки и история чата.</p><button onClick={()=>setConfirm({kind:"delete"})}><Ban size={15}/>Удалить клан</button></div></div>:null}
    </div>}

    {createOpen?<div className="clan-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCreateOpen(false)}}><form className="clan-create-modal" onSubmit={createClan}><button type="button" className="clan-modal-close" onClick={()=>setCreateOpen(false)} aria-label="Закрыть"><X size={19}/></button><span><Swords size={24}/></span><h3>Создать клан</h3><p>До 50 участников. Вы автоматически станете лидером.</p><div className="clan-create-grid"><label><span>Название</span><input name="name" minLength={3} maxLength={32} required placeholder="Например, Zero Knights"/></label><label><span>Тег</span><input name="tag" minLength={2} maxLength={5} required placeholder="ZERO"/></label><label className="wide"><span>Описание</span><textarea name="description" rows={3} maxLength={500} placeholder="Расскажите о клане"/></label><label><span>Тип вступления</span><select name="joinType" defaultValue="application"><option value="open">Открытый</option><option value="application">По заявке</option><option value="closed">Только по приглашению</option></select></label><label><span>Аватар</span><input type="file" accept="image/*" onChange={event=>setCreateAvatar(event.target.files?.[0]??null)}/></label><label className="wide"><span>Баннер</span><input type="file" accept="image/*" onChange={event=>setCreateBanner(event.target.files?.[0]??null)}/></label></div><button className="clan-primary" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/>Создаём…</>:"Создать клан"}</button></form></div>:null}

    {profileUser?<UserProfilePopover key={profileUser.userId} userId={profileUser.userId} displayName={profileUser.displayName} onClose={()=>setProfileUser(null)} onOpenDirect={onOpenDirect}/>:null}
    {confirm?.kind==="leave"?<ConfirmDialog title="Покинуть клан?" description="Вы потеряете доступ к клановому чату и списку участников." confirmLabel="Покинуть" destructive onCancel={()=>setConfirm(null)} onConfirm={()=>void leaveClan()}/>:null}
    {confirm?.kind==="delete"&&detail?<ConfirmDialog title={`Удалить клан «${detail.clan.name}»?`} description="Все данные клана и сообщения будут удалены без возможности восстановления." confirmLabel="Удалить клан" destructive confirmationText={detail.clan.name} onCancel={()=>setConfirm(null)} onConfirm={()=>void deleteClan()}/>:null}
    {confirm?.kind==="kick"&&confirm.member?<ConfirmDialog title={`Исключить ${confirm.member.displayName}?`} description="Участник потеряет доступ к клану и чату." confirmLabel="Исключить" destructive onCancel={()=>setConfirm(null)} onConfirm={()=>{const member=confirm.member!;setConfirm(null);void memberAction(member,"kick")}}/>:null}
    {confirm?.kind==="transfer"&&confirm.member?<ConfirmDialog title={`Передать лидерство ${confirm.member.displayName}?`} description="Вы станете офицером, а выбранный участник получит полный контроль над кланом." confirmLabel="Передать лидерство" destructive onCancel={()=>setConfirm(null)} onConfirm={()=>{const member=confirm.member!;setConfirm(null);void memberAction(member,"transfer")}}/>:null}
  </section>;
}
