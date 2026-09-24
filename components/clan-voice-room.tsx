"use client";
import { useEffect, useRef, useState } from "react";
import { Headphones, Mic, MicOff, PhoneOff, Users } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
export function ClanVoiceRoom({clanId}:{clanId:string}){
 const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[participants,setParticipants]=useState<string[]>([]),[error,setError]=useState("");
 const roomRef=useRef<Room|null>(null),audioRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>()=>{void roomRef.current?.disconnect();roomRef.current=null},[]);
 async function join(){if(busy||connected)return;setBusy(true);setError("");const room=new Room();try{
  const response=await fetch(`/api/v1/clans/${clanId}/voice-token`,{method:"POST"}),data=await response.json();if(!response.ok)throw Error(data.message??"Голосовой сервер недоступен.");
  room.on(RoomEvent.TrackSubscribed,(track)=>{if(track.kind===Track.Kind.Audio)audioRef.current?.appendChild(track.attach())});
  room.on(RoomEvent.TrackUnsubscribed,track=>{track.detach().forEach(element=>element.remove())});
  const update=()=>setParticipants([room.localParticipant.name||"Вы",...[...room.remoteParticipants.values()].map(person=>person.name||"Участник")]);
  room.on(RoomEvent.ParticipantConnected,update);room.on(RoomEvent.ParticipantDisconnected,update);
  await room.connect(data.url,data.token);roomRef.current=room;await room.localParticipant.setMicrophoneEnabled(true);update();setConnected(true);
 }catch(reason){await room.disconnect();setError(reason instanceof Error?reason.message:"Не удалось подключиться.")}finally{setBusy(false)}}
 async function leave(){await roomRef.current?.disconnect();roomRef.current=null;setConnected(false);setParticipants([]);setMuted(false)}
 async function toggle(){const next=!muted;try{await roomRef.current?.localParticipant.setMicrophoneEnabled(!next);setMuted(next)}catch{setError("Не удалось изменить микрофон.")}}
 return <section className="clan-voice"><div ref={audioRef} aria-hidden="true"/><h3><Headphones size={19}/> Голосовая комната клана</h3><p>Место для живого разговора участников.</p>{error?<p role="alert">{error}</p>:null}{connected?<><span><Users size={16}/>В комнате: {participants.join(", ")}</span><div><button onClick={()=>void toggle()} aria-label={muted?"Включить микрофон":"Выключить микрофон"}>{muted?<MicOff/>:<Mic/>}{muted?"Включить":"Выключить"}</button><button onClick={()=>void leave()}><PhoneOff/>Выйти</button></div></>:<button disabled={busy} onClick={()=>void join()}><Mic size={17}/>{busy?"Подключаем…":"Войти в комнату"}</button>}</section>
}
