"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check, ChevronUp, Headphones, Mic, MicOff, Settings, SlidersHorizontal, Volume2, VolumeX,
} from "lucide-react";
import { MediaImage } from "./media-image";

type DockUser={id:string;displayName:string;avatarUrl?:string|null;globalLevel?:number};
type AudioPrefs={inputId?:string;outputId?:string;inputVolume?:number;outputVolume?:number;inputProfile?:"standard"|"noise"|"raw"};

function readPrefs():AudioPrefs{
  if(typeof window==="undefined")return{};
  try{return JSON.parse(localStorage.getItem("flipzero:audio-devices:v1")??"{}") as AudioPrefs}catch{return{}}
}
function savePrefs(prefs:AudioPrefs){try{localStorage.setItem("flipzero:audio-devices:v1",JSON.stringify(prefs))}catch{}}
function emit(detail:Record<string,unknown>){window.dispatchEvent(new CustomEvent("flipzero:voice-control",{detail}))}

export function UserDock({
  user,
  onOpenProfile,
  onOpenSettings,
  onOpenVoiceSettings,
}:{
  user:DockUser|null;
  onOpenProfile:()=>void;
  onOpenSettings:()=>void;
  onOpenVoiceSettings:()=>void;
}){
  const rootRef=useRef<HTMLDivElement|null>(null);
  const inputButton=useRef<HTMLButtonElement|null>(null);
  const outputButton=useRef<HTMLButtonElement|null>(null);
  const menuRef=useRef<HTMLElement|null>(null);
  const [position,setPosition]=useState({left:8,top:8});
  const [menu,setMenu]=useState<"input"|"output"|null>(null);
  const [inputs,setInputs]=useState<MediaDeviceInfo[]>([]);
  const [outputs,setOutputs]=useState<MediaDeviceInfo[]>([]);
  const [prefs,setPrefs]=useState<AudioPrefs>(()=>readPrefs());
  const [muted,setMuted]=useState(false);
  const [deafened,setDeafened]=useState(false);
  useEffect(()=>{
    if(!menu)return;
    let cancelled=false;
    void navigator.mediaDevices?.enumerateDevices?.().then((devices)=>{
      if(cancelled)return;
      setInputs(devices.filter((item)=>item.kind==="audioinput"));
      setOutputs(devices.filter((item)=>item.kind==="audiooutput"));
    }).catch(()=>{});
    const button=(menu==="input"?inputButton:outputButton).current;
    const place=()=>{if(!button)return;const rect=button.getBoundingClientRect();const width=Math.min(300,window.innerWidth-16);const height=Math.min(menuRef.current?.offsetHeight??360,window.innerHeight-16);setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:rect.top>=height+8?rect.top-height-8:Math.min(window.innerHeight-height-8,rect.bottom+8)});};
    requestAnimationFrame(place);
    const closeOutside=(event:PointerEvent)=>{const target=event.target;if(target instanceof Node&&!rootRef.current?.contains(target)&&!menuRef.current?.contains(target))setMenu(null)};
    const closeEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenu(null)};
    document.addEventListener("pointerdown",closeOutside);document.addEventListener("keydown",closeEscape);
    window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return()=>{cancelled=true;document.removeEventListener("pointerdown",closeOutside);document.removeEventListener("keydown",closeEscape);window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true)};
  },[menu]);

  function updatePrefs(next:AudioPrefs){setPrefs(next);savePrefs(next)}
  function chooseInput(inputId:string){const next={...prefs,inputId};updatePrefs(next);emit({type:"input-device",deviceId:inputId});}
  function chooseOutput(outputId:string){const next={...prefs,outputId};updatePrefs(next);emit({type:"output-device",deviceId:outputId});}
  function changeInputVolume(inputVolume:number){const next={...prefs,inputVolume};updatePrefs(next);emit({type:"input-volume",value:inputVolume});}
  function changeOutputVolume(outputVolume:number){const next={...prefs,outputVolume};updatePrefs(next);emit({type:"output-volume",value:outputVolume});}
  function changeProfile(inputProfile:AudioPrefs["inputProfile"]){const next={...prefs,inputProfile};updatePrefs(next);emit({type:"input-profile",profile:inputProfile});}
  function toggleMic(){const next=!muted;setMuted(next);emit({type:"toggle-mic",muted:next})}
  function toggleDeafen(){const next=!deafened;setDeafened(next);emit({type:"toggle-output",deafened:next})}

  return <div ref={rootRef} className="user-dock">
    <button className="dock-profile" type="button" onClick={onOpenProfile} aria-label="Открыть свой профиль" title="Открыть профиль">
      <span className="avatar avatar-coral">{user?.avatarUrl?<MediaImage src={user.avatarUrl}/>:user?.displayName.split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toLocaleUpperCase("ru")??"FZ"}<span className="presence"/></span>
      <span className="dock-copy"><strong>{user?.displayName??"Профиль"}</strong><small>Уровень {user?.globalLevel??1}</small></span>
    </button>

    <div className="dock-audio-control">
      <button type="button" className={muted?"is-muted":""} onClick={toggleMic} aria-label={muted?"Включить микрофон":"Выключить микрофон"} title={muted?"Включить микрофон":"Выключить микрофон"}>{muted?<MicOff size={17}/>:<Mic size={17}/>}</button>
      <button ref={inputButton} type="button" className="dock-chevron" onClick={()=>setMenu(menu==="input"?null:"input")} aria-label="Настройки микрофона" title="Настройки микрофона" aria-expanded={menu==="input"}><ChevronUp size={13}/></button>
    </div>

    <div className="dock-audio-control">
      <button type="button" className={deafened?"is-muted":""} onClick={toggleDeafen} aria-label={deafened?"Включить звук":"Отключить звук"} title={deafened?"Включить звук":"Отключить звук"}>{deafened?<VolumeX size={17}/>:<Headphones size={17}/>}</button>
      <button ref={outputButton} type="button" className="dock-chevron" onClick={()=>setMenu(menu==="output"?null:"output")} aria-label="Настройки наушников" title="Настройки наушников" aria-expanded={menu==="output"}><ChevronUp size={13}/></button>
    </div>

    <button type="button" onClick={onOpenSettings} aria-label="Настройки аккаунта" title="Настройки аккаунта"><Settings size={17}/></button>

    {menu==="input"?createPortal(<section ref={menuRef} style={position} className="dock-device-menu dock-device-menu-input dock-device-floating" role="dialog" aria-label="Настройки микрофона">
      <header><Mic size={16}/><strong>Микрофон</strong></header>
      <div className="dock-device-section"><span>Устройство ввода</span><div className="dock-device-list">{inputs.length?inputs.map((device,index)=><button type="button" key={device.deviceId||index} className={prefs.inputId===device.deviceId?"active":""} onClick={()=>chooseInput(device.deviceId)}><span>{device.label||`Микрофон ${index+1}`}</span>{prefs.inputId===device.deviceId?<Check size={14}/>:null}</button>):<small>Устройства появятся после разрешения доступа к микрофону.</small>}</div></div>
      <label className="dock-range"><span>Громкость микрофона <b>{prefs.inputVolume??100}%</b></span><input type="range" min="0" max="100" value={prefs.inputVolume??100} onChange={(event)=>changeInputVolume(Number(event.target.value))}/></label>
      <label className="dock-select"><span>Профиль ввода</span><select value={prefs.inputProfile??"standard"} onChange={(event)=>changeProfile(event.target.value as AudioPrefs["inputProfile"])}><option value="standard">Стандартный</option><option value="noise">Шумоподавление</option><option value="raw">Без обработки</option></select></label>
      <button className="dock-settings-link" type="button" onClick={()=>{setMenu(null);onOpenVoiceSettings()}}><SlidersHorizontal size={15}/>Настройки голоса</button>
    </section>,document.body):null}

    {menu==="output"?createPortal(<section ref={menuRef} style={position} className="dock-device-menu dock-device-menu-output dock-device-floating" role="dialog" aria-label="Настройки наушников">
      <header><Volume2 size={16}/><strong>Наушники</strong></header>
      <div className="dock-device-section"><span>Устройство вывода</span><div className="dock-device-list">{outputs.length?outputs.map((device,index)=><button type="button" key={device.deviceId||index} className={prefs.outputId===device.deviceId?"active":""} onClick={()=>chooseOutput(device.deviceId)}><span>{device.label||`Динамик ${index+1}`}</span>{prefs.outputId===device.deviceId?<Check size={14}/>:null}</button>):<small>Выбор устройства вывода зависит от браузера и системы.</small>}</div></div>
      <label className="dock-range"><span>Громкость звука <b>{prefs.outputVolume??100}%</b></span><input type="range" min="0" max="100" value={prefs.outputVolume??100} onChange={(event)=>changeOutputVolume(Number(event.target.value))}/></label>
      <button className="dock-settings-link" type="button" onClick={()=>{setMenu(null);onOpenVoiceSettings()}}><SlidersHorizontal size={15}/>Настройки голоса</button>
    </section>,document.body):null}
  </div>;
}
