"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { AppIcon } from "./app-icon";
import { type ClanTagData } from "./clan-tag";
import { DirectCallOverlay } from "./direct-call-overlay";
import { ProfileAppearanceSurface } from "./profile-appearance-surface";
import { FullUserProfile } from "./full-user-profile";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { useProfileSafety } from "@/hooks/use-profile-safety";
import { ProfileReportDialog } from "./profile-report-dialog";
import { ProfileMenu } from "./profile-menu";
import { Dialog } from "./ui/dialog";
import Link from "next/link";

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
  standalone = false,
  onClose,
  onOpenDirect,
}: {
  userId:string;
  displayName:string;
  anchor?:Anchor;
  standalone?:boolean;
  onClose:()=>void;
  onOpenDirect?:(userId:string)=>void;
}) {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [error,setError]=useState("");
  const [menu,setMenu]=useState(false);
  const [full,setFull]=useState(false);
  const [fullTab,setFullTab]=useState<FullTab>("activity");
  const [callMode,setCallMode]=useState<CallMode>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const { reporting, setReporting, ignored, toggleIgnore, block, submitReport, safetyBusy } = useProfileSafety(userId, setNotice, ()=>setMenu(false));
  const miniRef=useModalA11y(onClose,!standalone&&!full&&!reporting&&!callMode&&Boolean(profile));

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
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){if(menu){setMenu(false);event.stopPropagation();return}if(!full&&!reporting&&!standalone)onClose()}};
    const onPointer=(event:PointerEvent)=>{if(!menu)return;const target=event.target;if(target instanceof Node&&!miniRef.current?.contains(target))setMenu(false)};
    document.addEventListener("keydown",onKey);document.addEventListener("pointerdown",onPointer);
    return()=>{document.removeEventListener("keydown",onKey);document.removeEventListener("pointerdown",onPointer)};
  },[menu,full,reporting,onClose,standalone]);

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

  async function copyId(){try{await navigator.clipboard.writeText(userId);setNotice("ID пользователя скопирован.");}catch{setNotice("Не удалось скопировать ID.");}setMenu(false)}
  function message(){onOpenDirect?.(userId);if(!standalone)onClose()}

  const position:CSSProperties|undefined=anchor&&typeof window!=="undefined"?{left:Math.max(12,Math.min(anchor.x,window.innerWidth-360)),top:Math.max(12,Math.min(anchor.y,window.innerHeight-520))}:undefined;
  const p=profile?.id===userId?profile:null;
  return <div className={standalone?"profile-page":"fz-user-profile-layer"} role="presentation" onMouseDown={(event)=>{if(!standalone&&event.target===event.currentTarget&&!full&&!reporting)onClose()}}>
    {standalone?<nav><Link href="/app">← Вернуться в FlipZero</Link></nav>:null}
    {!p?<section ref={miniRef} className="fz-mini-profile" style={{...position,"--profile-accent":"var(--accent,#8f70ff)"} as CSSProperties} role="dialog" aria-label={`Профиль ${displayName}`}>
      <div className="fz-mini-profile-state">{error?<><AppIcon name="check"/><strong>Профиль недоступен</strong><small>{error}</small></>:<><AppIcon name="loading" className="spin"/><span>Загрузка профиля…</span></>}</div>
    </section>:!standalone?<ProfileAppearanceSurface
      rootRef={miniRef}
      inactive={full||reporting||Boolean(callMode)}
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
        <Link className="fz-profile-link" href={`/users/${p.id}`}>Открыть по ссылке</Link>
        <button className="fz-mini-full" type="button" onClick={()=>setFull(true)}>Посмотреть полный профиль</button>
        {notice?<p className="fz-mini-notice" role="status">{notice}</p>:null}
      </>}
      afterBody={menu?<ProfileMenu isOwnProfile={p.isOwnProfile} isFriend={p.isFriend} ignored={ignored} busy={busy||safetyBusy} onFull={()=>{setMenu(false);setFull(true)}} onIgnore={toggleIgnore} onFriend={()=>void friendAction()} onBlock={()=>void block()} onReport={()=>{setNotice("");setReporting(true)}} onCopy={()=>void copyId()}/>:null}
    />:null}

    {standalone&&notice?<p role="status">{notice}</p>:null}
    {p&&standalone?<FullUserProfile
        profile={p} tab={fullTab} busy={busy} onTab={setFullTab}
        onClose={standalone?onClose:()=>setFull(false)}
        onMessage={message} onVoice={()=>setCallMode("voice")} onVideo={()=>setCallMode("video")}
        onFriendAction={()=>void friendAction()}
        onSaved={updates=>setProfile(current=>current?{...current,...updates}:current)}
      />:p&&full?<Dialog backdropClassName="fz-full-profile-backdrop fz-profile-v2-backdrop" className="profile-dialog-shell" label={`Полный профиль ${p.displayName}`} onClose={()=>setFull(false)}><FullUserProfile
        profile={p} tab={fullTab} busy={busy} onTab={setFullTab}
        onClose={standalone?onClose:()=>setFull(false)}
        onMessage={message} onVoice={()=>setCallMode("voice")} onVideo={()=>setCallMode("video")}
        onFriendAction={()=>void friendAction()}
        onSaved={updates=>setProfile(current=>current?{...current,...updates}:current)}
      /></Dialog>:null}
    {p&&reporting?<ProfileReportDialog username={p.username} notice={notice} busy={safetyBusy} onClose={()=>setReporting(false)} onSubmit={submitReport}/>:null}
    {p&&callMode?<DirectCallOverlay person={p} video={callMode==="video"} onClose={()=>setCallMode(null)}/>:null}
  </div>;
}
