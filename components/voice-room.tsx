"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, LoaderCircle, Mic, MicOff, PhoneOff, Radio, Users } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";

type VoiceStatus = "idle" | "connecting" | "connected";

export function VoiceRoom({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [status, setStatus] = useState<VoiceStatus>("idle"); const [muted, setMuted] = useState(false); const [participantCount, setParticipantCount] = useState(0); const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null); const audioRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { roomRef.current?.disconnect(); roomRef.current = null; }, [channelId]);
  async function join() { setStatus("connecting"); setError(""); const response = await fetch(`/api/v1/channels/${channelId}/voice-token`, { method: "POST" }); const data = await response.json(); if (!response.ok) { setStatus("idle"); setError(data.message ?? "Не удалось подключиться."); return; } try { const room = new Room({ adaptiveStream: true, dynacast: true }); const refresh = () => setParticipantCount(room.remoteParticipants.size + 1); room.on(RoomEvent.ParticipantConnected, refresh); room.on(RoomEvent.ParticipantDisconnected, refresh); room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach()); }); room.on(RoomEvent.Disconnected, () => { setStatus("idle"); setParticipantCount(0); }); await room.connect(data.url, data.token); await room.localParticipant.setMicrophoneEnabled(true); await room.startAudio(); roomRef.current = room; refresh(); setMuted(false); setStatus("connected"); } catch { roomRef.current?.disconnect(); roomRef.current = null; setStatus("idle"); setError("Не удалось установить голосовое соединение."); } }
  async function toggleMute() { const room = roomRef.current; if (!room) return; const next = !muted; await room.localParticipant.setMicrophoneEnabled(!next); setMuted(next); }
  function leave() { roomRef.current?.disconnect(); roomRef.current = null; setStatus("idle"); setParticipantCount(0); }
  return <div className="voice-room"><div ref={audioRef} className="remote-audio" /><section className="voice-hero"><div className={`voice-orb ${status === "connected" ? "is-live" : ""}`}><Radio size={38} /></div><small>ГОЛОСОВАЯ КОМНАТА</small><h1>{channelName}</h1><p>{status === "connected" ? "Вы в эфире. Общайтесь с участниками в реальном времени." : "Подключайтесь к разговору с качественным пространственным звуком."}</p>{status === "connected" ? <div className="voice-online"><Users size={16} /> В комнате: {participantCount}</div> : null}{error ? <div className="voice-error">{error}</div> : null}{status === "idle" ? <button className="voice-join" onClick={join}><Headphones size={19} /> Подключиться</button> : status === "connecting" ? <button className="voice-join" disabled><LoaderCircle className="spin" size={19} /> Подключение...</button> : <div className="voice-controls"><button className={muted ? "is-muted" : ""} onClick={toggleMute}>{muted ? <MicOff size={20} /> : <Mic size={20} />}<span>{muted ? "Включить" : "Микрофон"}</span></button><button className="voice-leave" onClick={leave}><PhoneOff size={20} /><span>Выйти</span></button></div>}</section></div>;
}
