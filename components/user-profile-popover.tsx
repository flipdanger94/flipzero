"use client";

import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { AppIcon } from "./app-icon";
import { MediaImage } from "./media-image";
import { ClanTag, type ClanTagData } from "./clan-tag";
import { DirectCallOverlay } from "./direct-call-overlay";
import { ProfileVisitCard } from "./profile-visit-card";
import { ProfileAppearanceSurface } from "./profile-appearance-surface";
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

    {p&&full?<div className="fz-full-profile-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setFull(false)}}><section ref={fullRef} tabIndex={-1} className={`fz-full-profile effect-${p.cosmetics?.profile_effect??"none"} chat-${p.cosmetics?.message_effect??"none"}`} role="dialog" aria-modal="true" aria-label={`Полный профиль ${p.displayName}`} style={{"--profile-accent":"var(--accent,#8f70ff)"} as CSSProperties}>
      <button className="fz-full-close" type="button" onClick={()=>setFull(false)} aria-label="Закрыть полный профиль"><AppIcon name="close" size={20}/></button>
      <aside>
        <div className={`fz-full-banner cosmetic-${p.cosmetics?.banner??"none"}`} style={p.bannerUrl?{backgroundImage:`linear-gradient(180deg,transparent,#08101e),url("${p.bannerUrl}")`}:undefined}/>
        <div className={`fz-full-avatar frame-${p.cosmetics?.avatar_frame??"none"}`}>{p.avatarUrl?<MediaImage src={p.avatarUrl}/>:p.displayName.slice(0,2)}<i className={p.presence==="online"?"online":""}/></div>
        <div className="fz-full-name-row"><h2 className={p.cosmetics?.nickname?`nick-${p.cosmetics.nickname}`:""}>{p.displayName}</h2>{p.cosmetics?.badge?<span className={`store-profile-badge badge-${p.cosmetics.badge}`} title="Косметический значок">✦</span>:null}</div>{p.clan?<ClanTag clan={p.clan} variant="full" className="fz-full-clan-details"/>:null}<p>@{p.username}</p><small>Уровень {p.globalLevel} · {p.presence==="online"?"в сети":"не в сети"}</small>
        {!p.isOwnProfile?<div className="fz-profile-icon-actions fz-full-actions"><button onClick={message} aria-label="Написать сообщение" title="Написать сообщение"><AppIcon name="messages"/></button><button onClick={()=>setCallMode("voice")} aria-label="Голосовой звонок" title="Голосовой звонок"><AppIcon name="call"/></button><button onClick={()=>setCallMode("video")} aria-label="Видеозвонок" title="Видеозвонок"><AppIcon name="video"/></button><button onClick={()=>void friendAction()} aria-label={p.friendshipStatus==="friends"?"Удалить из друзей":"Добавить в друзья"} title={p.friendshipStatus==="friends"?"Удалить из друзей":p.friendshipStatus==="outgoing"?"Заявка отправлена":"Добавить в друзья"} disabled={busy||p.friendshipStatus==="outgoing"}>{p.friendshipStatus==="friends"?<AppIcon name="user-remove"/>:p.friendshipStatus==="outgoing"?<AppIcon name="check"/>:<AppIcon name="friends"/>}</button></div>:null}
        <section><h3>О пользователе</h3><p>{p.bio||"Описание не заполнено."}</p>{p.profileStatus?<span>{p.profileStatus}</span>:null}</section>
        <div className="fz-full-stats"><span><b>{p.stats.messages}</b><small>сообщений</small></span><span><b>{p.stats.friends}</b><small>друзей</small></span><span><b>{p.stats.servers}</b><small>серверов</small></span></div>
      </aside>
      <main>
        <ProfileVisitCard key={p.id} profile={p} onSaved={updates=>setProfile(current=>current?{...current,...updates}:current)}/>
        <section className="fz-profile-equipped-showcase" aria-label="Экипированное оформление профиля">
          <article><small>Рамка аватара</small><div className={`fz-profile-equipped-avatar frame-${p.cosmetics?.avatar_frame??"none"}`}>{p.avatarUrl?<MediaImage src={p.avatarUrl}/>:p.displayName.slice(0,2)}</div></article>
          <article className={`effect-${p.cosmetics?.profile_effect??"none"}`}><small>Эффект профиля</small><strong>{p.cosmetics?.profile_effect?"Активен":"Не выбран"}</strong></article>
          <article><small>Баннер</small><div className={`fz-profile-equipped-banner cosmetic-${p.cosmetics?.banner??"none"}`}/></article>
          <article><small>Стиль имени</small><strong className={p.cosmetics?.nickname?`nick-${p.cosmetics.nickname}`:""}>{p.displayName}</strong></article>
          <article><small>Значок</small><strong>{p.cosmetics?.badge?<span className={`store-profile-badge badge-${p.cosmetics.badge}`}>✦ Экипирован</span>:"Не выбран"}</strong></article>
          <article><small>Стиль сообщений</small><div className={`fz-profile-equipped-message message-effect-${p.cosmetics?.message_effect??"none"}`}>Пример сообщения</div></article>
        </section>
        <nav><button className={fullTab==="activity"?"active":""} onClick={()=>setFullTab("activity")}>Активность</button><button className={fullTab==="friends"?"active":""} onClick={()=>setFullTab("friends")}>Общие друзья <b>{p.commonFriends.length}</b></button><button className={fullTab==="servers"?"active":""} onClick={()=>setFullTab("servers")}>Общие серверы <b>{p.commonServers.length}</b></button></nav>
        {fullTab==="activity"?<div className="fz-full-empty"><strong>{p.presence==="online"?"Сейчас в сети":"Сейчас не в сети"}</strong><p>{p.profileStatus||"Публичной активности пока нет."}</p><div className="fz-activity-cards"><span><b>{p.globalXp}</b><small>XP аккаунта</small></span><span><b>{p.globalLevel}</b><small>уровень</small></span><span><b>{new Date(p.createdAt).toLocaleDateString("ru-RU")}</b><small>в FlipZero с</small></span></div><div className="fz-profile-xp-progress"><span>{p.globalLevel>=100?"Уровень 100":`Прогресс до уровня ${p.globalLevel+1}`}<b>{p.globalLevel>=100?"MAX":`${p.xpToNextLevel} XP осталось`}</b></span><i><b style={{width:`${p.globalLevel>=100?100:Math.max(0,Math.min(100,((p.globalXp-p.currentLevelXp)/Math.max(1,p.nextLevelXp-p.currentLevelXp))*100))}%`}}/></i></div></div>:null}
        {fullTab==="friends"?<div className="fz-full-list">{p.commonFriends.length?p.commonFriends.map(friend=><article key={friend.id}><i>{friend.avatarUrl?<MediaImage src={friend.avatarUrl}/>:friend.displayName.slice(0,2)}</i><span><strong>{friend.displayName}</strong><small>@{friend.username}</small></span></article>):<div className="fz-full-empty"><strong>Нет общих друзей</strong><p>Когда появятся общие контакты, они будут показаны здесь.</p></div>}</div>:null}
        {fullTab==="servers"?<div className="fz-full-list">{p.commonServers.length?p.commonServers.map(server=><article key={server.id}><i>{server.iconUrl?<MediaImage src={server.iconUrl}/>:server.name.slice(0,2)}</i><span><strong>{server.name}</strong><small>Общее пространство</small></span></article>):<div className="fz-full-empty"><strong>Нет общих серверов</strong><p>Общие пространства появятся здесь.</p></div>}</div>:null}
      </main>
    </section></div>:null}

    {p&&reporting?<div className="fz-profile-report-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setReporting(false)}}><section ref={reportRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Пожаловаться на профиль"><form className="fz-profile-report" onSubmit={submitReport}><h3>Пожаловаться на профиль</h3><p>@{p.username}</p><label>Причина<select name="reason" defaultValue="harassment"><option value="harassment">Оскорбления / травля</option><option value="spam">Спам</option><option value="fraud">Мошенничество</option><option value="impersonation">Выдаёт себя за другого</option><option value="unwanted_content">Нежелательный контент</option><option value="other">Другое</option></select></label><label>Описание<textarea name="description" rows={4} maxLength={2000}/></label><footer><button type="button" onClick={()=>setReporting(false)}>Отмена</button><button disabled={busy}>Отправить</button></footer></form></section></div>:null}
    {p&&callMode?<DirectCallOverlay person={p} video={callMode==="video"} onClose={()=>setCallMode(null)}/>:null}
  </div>;
}
