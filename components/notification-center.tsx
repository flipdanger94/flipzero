"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Crown, MessageCircle, Swords, UserPlus, X } from "lucide-react";

type Item={
  id:string;
  type:string;
  title:string;
  body:string|null;
  entityType:string|null;
  entityId:string|null;
  readAt:string|null;
  createdAt:string;
  actor:{id:string;username:string;displayName:string;avatarUrl:string|null}|null;
};

export function NotificationCenter({onOpenMessages,onOpenFriends,onOpenClans}:{onOpenMessages:(userId:string|null)=>void;onOpenFriends:()=>void;onOpenClans:()=>void}){
 const [open,setOpen]=useState(false),[items,setItems]=useState<Item[]>([]),[unread,setUnread]=useState(0);
 const load=useCallback(async()=>{const r=await fetch("/api/notifications",{cache:"no-store"});if(r.ok){const d=await r.json();setItems(d.notifications??[]);setUnread(d.unread??0)}},[]);

 useEffect(()=>{const first=window.setTimeout(()=>void load(),0);const t=window.setInterval(()=>void load(),15000);return()=>{window.clearTimeout(first);window.clearInterval(t)}},[load]);
 useEffect(()=>{const close=()=>setOpen(false);window.addEventListener("flipzero:close-notifications",close);return()=>window.removeEventListener("flipzero:close-notifications",close)},[]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.body.style.overflow="hidden";document.addEventListener("keydown",onKeyDown);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",onKeyDown)}},[open]);

 async function read(item:Item){
  if(!item.readAt)await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});
  setItems(v=>v.map(x=>x.id===item.id?{...x,readAt:new Date().toISOString()}:x));
  setUnread(v=>Math.max(0,v-(item.readAt?0:1)));
  setOpen(false);
  if(item.type==="friend_request")onOpenFriends();
  else if(item.type==="direct_message"||item.type==="friend_accepted"||item.type==="direct_call")onOpenMessages(item.actor?.id??null);
  else if(item.type.startsWith("clan_")||item.entityType==="clan")onOpenClans();
 }

 async function readAll(){
  await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({all:true})});
  setItems(v=>v.map(x=>({...x,readAt:x.readAt??new Date().toISOString()})));
  setUnread(0);
 }

 async function dismiss(item:Item){
  const r=await fetch("/api/notifications",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});
  if(!r.ok)return;
  setItems(v=>v.filter(x=>x.id!==item.id));
  if(!item.readAt)setUnread(v=>Math.max(0,v-1));
 }

 function toggle(){
  setOpen(current=>{
    const next=!current;
    if(next&&window.matchMedia("(max-width: 767px)").matches)window.dispatchEvent(new CustomEvent("flipzero:mobile-overlay-open",{detail:"notifications"}));
    return next;
  });
 }

 const overlay=open&&typeof document!=="undefined"?createPortal(
  <div className="notification-portal" role="presentation">
   <button type="button" className="notification-scrim" aria-label="Закрыть уведомления" onClick={()=>setOpen(false)}/>
   <section className="notification-popover" role="dialog" aria-modal="true" aria-label="Уведомления">
    <header>
     <div><small>FLIPZERO</small><h3>Уведомления</h3></div>
     <button type="button" className="notification-close" onClick={()=>setOpen(false)} aria-label="Закрыть уведомления"><X size={18}/></button>
    </header>
    {unread?<button type="button" className="notification-read-all" onClick={()=>void readAll()}><CheckCheck size={15}/>Прочитать все</button>:null}
    <div className="notification-list" tabIndex={0}>
     {items.length?items.map(item=><article key={item.id} className={item.readAt?"":"unread"}>
      <button type="button" className="notification-open" onClick={()=>void read(item)}>
       <i>{item.type==="friend_request"||item.type==="friend_accepted"?<UserPlus size={17}/>:item.type==="superflip_gift"?<Crown size={17}/>:item.type.startsWith("clan_")?<Swords size={17}/>:<MessageCircle size={17}/>}</i>
       <span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.createdAt).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time></span>
      </button>
      <button type="button" className="notification-dismiss" aria-label={`Удалить уведомление «${item.title}»`} title="Удалить уведомление" onClick={()=>void dismiss(item)}><X size={16}/></button>
     </article>):<p>Новых событий пока нет.</p>}
    </div>
   </section>
  </div>,
  document.body
 ):null;

 return <><div className="notification-center"><button type="button" className={open?"is-active":""} aria-label="Уведомления" aria-expanded={open} onClick={toggle}><Bell size={19}/>{unread?<b className="notification-badge">{unread>99?"99+":unread}</b>:null}</button></div>{overlay}</>;
}
