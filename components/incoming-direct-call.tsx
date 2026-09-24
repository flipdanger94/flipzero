"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { DirectCallOverlay, type CallPerson, type DirectCallConnection } from "./direct-call-overlay";
import { MediaImage } from "./media-image";

type IncomingCall={
  id:string;
  callerId:string;
  video:boolean;
  expiresAt:string;
  displayName:string;
  avatarUrl:string|null;
};

export function IncomingDirectCall(){
  const [call,setCall]=useState<IncomingCall|null>(null);
  const [connection,setConnection]=useState<{person:CallPerson;video:boolean;connection:DirectCallConnection}|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(connection)return;
    let cancelled=false;
    const load=async()=>{
      if(document.visibilityState!=="visible")return;
      const response=await fetch("/api/v1/direct-calls/incoming",{cache:"no-store"}).catch(()=>null);
      if(!response?.ok||cancelled)return;
      const data=await response.json();
      setCall(data.call??null);
    };
    void load();
    const timer=window.setInterval(()=>void load(),2000);
    const visible=()=>{if(document.visibilityState==="visible")void load()};
    document.addEventListener("visibilitychange",visible);
    return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
  },[connection]);

  async function act(action:"accept"|"decline"){
    if(!call||busy)return;
    setBusy(true);
    try{
      const response=await fetch("/api/v1/direct-calls/incoming",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callId:call.id,action})});
      const data=await response.json();
      if(!response.ok){setCall(null);return}
      if(action==="accept"){
        setConnection({
          person:{id:call.callerId,displayName:call.displayName,avatarUrl:call.avatarUrl},
          video:call.video,
          connection:{token:data.token,url:data.url,callId:call.id,role:"receiver"},
        });
      }
      setCall(null);
    } finally {setBusy(false)}
  }

  if(connection)return <DirectCallOverlay person={connection.person} video={connection.video} connection={connection.connection} onClose={()=>setConnection(null)}/>;
  if(!call)return null;

  return <div className="incoming-call-toast" role="dialog" aria-modal="true" aria-label={call.video?"Входящий видеозвонок":"Входящий звонок"}>
    <span className="incoming-call-avatar">{call.avatarUrl?<MediaImage src={call.avatarUrl}/>:call.displayName.slice(0,2).toLocaleUpperCase("ru")}</span>
    <div><small>{call.video?"ВХОДЯЩИЙ ВИДЕОЗВОНОК":"ВХОДЯЩИЙ ЗВОНОК"}</small><strong>{call.displayName}</strong><span>Ответить в течение нескольких секунд</span></div>
    <button className="accept" disabled={busy} onClick={()=>void act("accept")} aria-label="Принять звонок">{call.video?<Video size={19}/>:<Phone size={19}/>}</button>
    <button className="decline" disabled={busy} onClick={()=>void act("decline")} aria-label="Отклонить звонок"><PhoneOff size={19}/></button>
  </div>;
}
