"use client";

import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { AppIcon } from "./app-icon";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";
import { DirectCallOverlay } from "./direct-call-overlay";
import { ProfileAppearanceSurface } from "./profile-appearance-surface";
import { FullUserProfile } from "./full-user-profile";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type CommonFriend = { id:string; username:string; displayName:string; avatarUrl:string|null };
type CommonServer = { id:string; name:string; iconUrl:string|null };
type Profile = {
  id:string; username:string; displayName:string; avatarUrl:string|null; bannerUrl:string|null; bio:string|null;
  presence:string; globalLevel:number; globalXp:number; createdAt:string; profileLocation:string|null;
  profileStatus:string|null; currentLevelXp:number; nextLevelXp:number; xpToNextLevel:number; isOwnProfile:boolean; isFriend:boolean; friendshipStatus:"friends"|"outgoing"|"incoming"|"none";
  incomingRequestId:string|null; stats:{messages:number;friends:number;servers:number}; commonFriends:CommonFriend[];
  commonServers:CommonServer[]; servers:Array<{id:string;name:string;iconUrl:string|null}>;
  clan:ClanTagData|null;cosmetics?:Record<string,string>;badges?:Array<{id:string;name:string;icon:string;rarity:string}>;profileGames?:string[];profileMusic?:{title?:string;artist?:string;url?:string};profileWidgets?:string[];customStatusEmoji?:string|null;customStatusExpiresAt?:string|null;profileLinks?:string[];
};

type Anchor = { x:number; y:number } | null;
type CallMode = "voice"|"video"|null;
type FullTab = "activity"|"friends"|"servers";

export function UserProfilePopover({
  userId,
  displayName,
  anchor = null,
  onClose,
  onOpenDirect,
}: {
  userId:string;
  displayName:string;
  anchor?:Anchor;
  onClose:()=>void;
  onOpenDirect?:(userId:string)=>void;
}) {
  const miniRef=useRef<HTMLElement|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [error,setError]=useState("");
  const [menu,setMenu]=useState(false);
  const [full,setFull]=useState(false);
  const [fullTab,setFullTab]=useState<FullTab>("activity");
  const [callMode,setCallMode]=useState<CallMode>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [reporting,setReporting]=useState(false);
  const [ignored,setIgnored]=useState(()=>{
    if(typeof window==="undefined") return false;
    try{return (JSON.parse(localStorage.getItem("flipzero:ignored-users:v1")??"[]") as string[]).includes(userId)}catch{return false}
  });
  const fullRef=useModalA11y(()=>setFull(false),full);
  const reportRef=useModalA11y(()=>setReporting(false),reporting);

  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    queueMicrotask(()=>{if(!cancelled){setProfile(null);setError("")}});
    void fetch(`/api/v1/users/${userId}/profile`,{cache:"no-store",signal:controller.signal})
      .then(async response=>({ok:response.ok,data:await response.json()}))
      .then(({ok,data})=>{if(cancelled)return;if(ok&&data.profile)setProfile(data.profile);else setError(data.message??"Не удалось загрузить профиль.")})
      .catch(()=>{if(!cancelled)setError("Не удалось загрузить профиль.")});
    return()=>{cancelled=true;controller.abort()};
  },[userId]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){if(menu){setMenu(false);event.stopPropagation();return}if(!full&&!reporting)onClose()}};
    const onPointer=(event:PointerEvent)=>{if(!menu)return;const target=event.target;if(target instanceof Node&&!miniRef.current?.contains(target))setMenu(false)};
    document.addEventListener("keydown",onKey);document.addEventListener("pointerdown",onPointer);
    return()=>{document.removeEventListener("keydown",onKey);document.removeEventListener("pointerdown",onPointer)};
  },[menu,full,reporting,onClose]);

  function toggleIgnore(){
    try{
      const current=new Set<string>(JSON.parse(localStorage.getItem("flipzero:ignored-users:v1")??"[]"));
      if(current.has(userId))current.delete(userId);else current.add(userId);
      localStorage.setItem("flipzero:ignored-users:v1",JSON.stringify([...current]));
      setIgnored(current.has(userId));setNotice(current.has(userId)?"Пользователь скрыт локально.":"Игнорирование отключено.");
    }catch{setNotice("Не удалось изменить настройку.")}
    setMenu(false);
  }

  async function friendAction(){
    if(!profile||profile.isOwnProfile||busy)return;
    setBusy(true);setNotice("");
    try{
      if(profile.friendshipStatus==="friends"){
        const response=await fetch(`/api/friends?friendId=${profile.id}`,{method:"DELETE"});
        if(!response.ok)throw new Error();
        setProfile({...profile,isFriend:false,friendshipStatus:"none"});setNotice("Удалён из друзей.");
      }else if(profile.friendshipStatus==="incoming"&&profile.incomingRequestId){
        const response=await fetch("/api/friends",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:profile.incomingRequestId,status:"accepted"})});
        if(!response.ok)throw new Error();
        setProfile({...profile,isFriend:true,friendshipStatus:"friends",incomingRequestId:null});setNotice("Теперь вы друзья.");
      }else if(profile.friendshipStatus!=="outgoing"){
        const response=await fetch("/api/friends",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({toId:profile.id})});
        if(!response.ok)throw new Error();
        setProfile({...profile,friendshipStatus:"outgoing"});setNotice("Заявка отправлена.");
      }
    }catch{setNotice("Не удалось выполнить действие.")}
    finally{setBusy(false)}
  }

  async function block(){
    if(!profile||profile.isOwnProfile||busy)return;
    setBusy(true);
    try{
      const response=await fetch("/api/blocks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({userId:profile.id})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.message??"Не удалось заблокировать пользователя.");
      setNotice("Пользователь заблокирован.");setMenu(false);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Не удалось заблокировать пользователя.")}
    finally{setBusy(false)}
  }

  async function submitReport(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!profile||busy)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);
    try{
      const response=await fetch("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetType:"profile",targetId:profile.id,reason:String(data.get("reason")??"other"),description:String(data.get("description")??"")})});
      if(!response.ok)throw new Error();
      setReporting(false);setMenu(false);setNotice("Жалоба отправлена модерации.");
    }catch{setNotice("Не удалось отправить жалобу.")}
    finally{setBusy(false)}
  }

  async function copyId(){try{await navigator.clipboard.writeText(userId);setNotice("ID пользователя скопирован.");}catch{setNotice("Не удалось скопировать ID.");}setMenu(false)}
  function message(){onOpenDirect?.(userId);onClose()}

  const position:CSSProperties|undefined=anchor&&typeof window!=="undefined"?{left:Math.max(12,Math.min(anchor.x,window.innerWidth-360)),top:Math.max(12,Math.min(anchor.y,window.innerHeight-520))}:undefined;
  const p=profile?.id===userId?profile:null;
  return <div className="fz-user-profile-layer" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!full&&!reporting)onClose()}}>
    {!p?<section ref={miniRef} className="fz-mini-profile" style={{...position,"--profile-accent":"var(--accent,#8f70ff)"} as CSSProperties} role="dialog" aria-label={`Профиль ${displayName}`}>
      <div className="fz-mini-profile-state">{error?<><AppIcon name="check"/><strong>Профиль недоступен</strong><small>{error}</small></>:<><AppIcon name="loading" className="spin"/><span>Загрузка профиля…</span></>}</div>
    </section>:<ProfileAppearanceSurface
      rootRef={miniRef}
      profile={p}
      className="fz-mini-profile-live"
      style={position}
      bannerActions={<button className="fz-mini-kebab" type="button" aria-label="Дополнительные действия" title="Дополнительные действия" aria-expanded={menu} onClick={()=>setMenu(value=>!value)}><AppIcon name="more" size={19}/></button>}
      actions={!p.isOwnProfile?<div className="fz-profile-icon-actions">
        <button type="button" onClick={message} aria-label="Написать сообщение" title="Написать сообщение"><AppIcon name="messages" size={17}/></button>
        <button type="button" onClick={()=>setCallMode("voice")} aria-label="Голосовой звонок" title="Голосовой звонок"><AppIcon name="call" size={17}/></button>
        <button type="button" onClick={()=>setCallMode("video")} aria-label="Видеозвонок" title="Видеозвонок"><AppIcon name="video" size={17}/></button>
        <button type="button" onClick={()=>void friendAction()} aria-label={p.friendshipStatus==="friends"?"Удалить из друзей":"Добавить в друзья"} title={p.friendshipStatus==="friends"?"Удалить из друзей":p.friendshipStatus==="outgoing"?"Заявка отправлена":"Добавить в друзья"} disabled={busy||p.friendshipStatus==="outgoing"}>{p.friendshipStatus==="friends"?<AppIcon name="user-remove" size={17}/>:p.friendshipStatus==="outgoing"?<AppIcon name="check" size={17}/>:<AppIcon name="friends" size={17}/>}</button>
      </div>:null}
      footer={<>
        <button className="fz-mini-full" type="button" onClick={()=>setFull(true)}>Посмотреть полный профиль</button>
        {notice?<p className="fz-mini-notice" role="status">{notice}</p>:null}
      </>}
      afterBody={menu?<div className="fz-profile-menu" role="menu">
        <button role="menuitem" onClick={()=>{setMenu(false);setFull(true)}}>Полный профиль</button>
        {!p.isOwnProfile?<><button role="menuitem" onClick={toggleIgnore}><AppIcon name="audio-off" size={15}/>{ignored?"Не игнорировать":"Игнорировать"}</button>
        {p.isFriend?<button role="menuitem" onClick={()=>void friendAction()}><AppIcon name="user-remove" size={15}/>Удалить из друзей</button>:null}
        <i/>
        <button role="menuitem" className="danger" onClick={()=>void block()}><AppIcon name="block" size={15}/>Заблокировать</button>
        <button role="menuitem" className="danger" onClick={()=>setReporting(true)}><AppIcon name="report" size={15}/>Пожаловаться</button>
        <i/></>:null}
        <button role="menuitem" onClick={()=>void copyId()}><AppIcon name="copy" size={15}/>Копировать ID</button>
      </div>:null}
    />}

    {p&&full?<div className="fz-full-profile-backdrop fz-profile-v2-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setFull(false)}}>
      <FullUserProfile
        profile={p}
        rootRef={fullRef}
        tab={fullTab}
        busy={busy}
        onTab={setFullTab}
        onClose={()=>setFull(false)}
        onMessage={message}
        onVoice={()=>setCallMode("voice")}
        onVideo={()=>setCallMode("video")}
        onFriendAction={()=>void friendAction()}
        onSaved={updates=>setProfile(current=>current?{...current,...updates}:current)}
      />
    </div>:null}

    {p&&reporting?<div className="fz-profile-report-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setReporting(false)}}><section ref={reportRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Пожаловаться на профиль"><form className="fz-profile-report" onSubmit={submitReport}><h3>Пожаловаться на профиль</h3><p>@{p.username}</p><label>Причина<select name="reason" defaultValue="harassment"><option value="harassment">Оскорбления / травля</option><option value="spam">Спам</option><option value="fraud">Мошенничество</option><option value="impersonation">Выдаёт себя за другого</option><option value="unwanted_content">Нежелательный контент</option><option value="other">Другое</option></select></label><label>Описание<textarea name="description" rows={4} maxLength={2000}/></label><footer><button type="button" onClick={()=>setReporting(false)}>Отмена</button><button disabled={busy}>Отправить</button></footer></form></section></div>:null}
    {p&&callMode?<DirectCallOverlay person={p} video={callMode==="video"} onClose={()=>setCallMode(null)}/>:null}
  </div>;
}
