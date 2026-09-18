"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, LoaderCircle, Mic, MicOff, MonitorUp, PhoneOff, Radio, Settings2, Signal, Users, Video, VideoOff } from "lucide-react";
import { ConnectionQuality, Room, RoomEvent, Track } from "livekit-client";

type VoiceStatus = "idle" | "connecting" | "connected" | "reconnecting";
const qualityLabels = { [ConnectionQuality.Excellent]: "Отличная", [ConnectionQuality.Good]: "Хорошая", [ConnectionQuality.Poor]: "Слабая", [ConnectionQuality.Lost]: "Нет связи", [ConnectionQuality.Unknown]: "Проверка" };

export function VoiceRoom({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false); const [camera, setCamera] = useState(false); const [sharing, setSharing] = useState(false); const [remoteVideo, setRemoteVideo] = useState(false);
  const [participantCount, setParticipantCount] = useState(0); const [quality, setQuality] = useState(ConnectionQuality.Unknown); const [activeSpeaker, setActiveSpeaker] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]); const [deviceId, setDeviceId] = useState(""); const [settings, setSettings] = useState(false); const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null); const audioRef = useRef<HTMLDivElement | null>(null); const remoteVideoRef = useRef<HTMLDivElement | null>(null); const localCameraRef = useRef<HTMLDivElement | null>(null); const localScreenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { roomRef.current?.disconnect(); roomRef.current = null; }, [channelId]);
  function clearMedia(container: HTMLDivElement | null) { container?.replaceChildren(); }
  function attachLocal(source: Track.Source, container: HTMLDivElement | null) { clearMedia(container); const track = roomRef.current?.localParticipant.getTrackPublication(source)?.track; if (track && container) container.appendChild(track.attach()); }

  async function join() {
    setStatus("connecting"); setError("");
    const response = await fetch(`/api/v1/channels/${channelId}/voice-token`, { method: "POST" }); const data = await response.json();
    if (!response.ok) { setStatus("idle"); setError(data.message ?? "Не удалось подключиться."); return; }
    try {
      const room = new Room({ adaptiveStream: true, dynacast: true }); const refresh = () => setParticipantCount(room.remoteParticipants.size + 1);
      room.on(RoomEvent.ParticipantConnected, refresh); room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => setActiveSpeaker(speakers[0]?.name || speakers[0]?.identity || ""));
      room.on(RoomEvent.ConnectionQualityChanged, (next, participant) => { if (participant.isLocal) setQuality(next); });
      room.on(RoomEvent.Reconnecting, () => setStatus("reconnecting")); room.on(RoomEvent.Reconnected, () => setStatus("connected"));
      room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach()); if (track.kind === Track.Kind.Video) { setRemoteVideo(true); window.requestAnimationFrame(() => remoteVideoRef.current?.appendChild(track.attach())); } });
      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((element) => element.remove()); setRemoteVideo(Boolean(remoteVideoRef.current?.childElementCount)); });
      room.on(RoomEvent.Disconnected, () => { setStatus("idle"); setParticipantCount(0); setCamera(false); setSharing(false); setRemoteVideo(false); setActiveSpeaker(""); });
      await room.connect(data.url, data.token); await room.localParticipant.setMicrophoneEnabled(true); await room.startAudio(); roomRef.current = room;
      const microphones = await Room.getLocalDevices("audioinput"); setDevices(microphones); setDeviceId(microphones[0]?.deviceId ?? ""); refresh(); setMuted(false); setStatus("connected");
    } catch { roomRef.current?.disconnect(); roomRef.current = null; setStatus("idle"); setError("Не удалось установить голосовое соединение."); }
  }

  async function chooseDevice(next: string) { if (!roomRef.current) return; await roomRef.current.switchActiveDevice("audioinput", next); setDeviceId(next); }
  async function toggleMute() { const room = roomRef.current; if (!room) return; const next = !muted; await room.localParticipant.setMicrophoneEnabled(!next); setMuted(next); }
  async function toggleCamera() { const room = roomRef.current; if (!room) return; const next = !camera; try { await room.localParticipant.setCameraEnabled(next); setCamera(next); if (next) window.requestAnimationFrame(() => attachLocal(Track.Source.Camera, localCameraRef.current)); else clearMedia(localCameraRef.current); } catch { setError("Не удалось включить камеру."); } }
  async function toggleScreen() { const room = roomRef.current; if (!room) return; const next = !sharing; try { await room.localParticipant.setScreenShareEnabled(next); setSharing(next); if (next) window.requestAnimationFrame(() => attachLocal(Track.Source.ScreenShare, localScreenRef.current)); else clearMedia(localScreenRef.current); } catch { setError("Демонстрация экрана отменена или недоступна."); } }
  function leave() { roomRef.current?.disconnect(); roomRef.current = null; [audioRef, remoteVideoRef, localCameraRef, localScreenRef].forEach((ref) => clearMedia(ref.current)); setStatus("idle"); setParticipantCount(0); setCamera(false); setSharing(false); setRemoteVideo(false); setSettings(false); }

  const showingVideo = camera || sharing || remoteVideo; const connected = status === "connected" || status === "reconnecting";
  return <div className={`voice-room ${showingVideo ? "has-video" : ""}`}><div ref={audioRef} className="remote-audio" />{showingVideo ? <div className="video-grid"><div ref={remoteVideoRef} className="remote-video" /><div ref={localScreenRef} className={`local-screen ${sharing ? "visible" : ""}`} /><div ref={localCameraRef} className={`local-camera ${camera ? "visible" : ""}`} /></div> : null}<section className="voice-hero"><div className={`voice-orb ${connected ? "is-live" : ""}`}><Radio size={38} /></div><small>ГОЛОСОВАЯ КОМНАТА</small><h1>{channelName}</h1><p>{connected ? status === "reconnecting" ? "Восстанавливаем соединение..." : "Вы в эфире. Можно включить камеру или показать экран." : "Подключайтесь к разговору с качественным пространственным звуком."}</p>{connected ? <div className="voice-status-row"><span className="voice-online"><Users size={16} /> В комнате: {participantCount}</span><span className={`quality quality-${quality}`}><Signal size={15} /> {qualityLabels[quality]}</span></div> : null}{activeSpeaker ? <div className="active-speaker"><i /> Сейчас говорит: <b>{activeSpeaker}</b></div> : null}{error ? <div className="voice-error">{error}</div> : null}{status === "idle" ? <button className="voice-join" onClick={join}><Headphones size={19} /> Подключиться</button> : status === "connecting" ? <button className="voice-join" disabled><LoaderCircle className="spin" size={19} /> Подключение...</button> : <><div className="voice-controls"><button className={muted ? "is-muted" : ""} onClick={toggleMute}>{muted ? <MicOff size={20} /> : <Mic size={20} />}<span>{muted ? "Включить" : "Микрофон"}</span></button><button className={camera ? "is-active" : ""} onClick={toggleCamera}>{camera ? <VideoOff size={20} /> : <Video size={20} />}<span>{camera ? "Выключить" : "Камера"}</span></button><button className={sharing ? "is-active" : ""} onClick={toggleScreen}><MonitorUp size={20} /><span>{sharing ? "Остановить" : "Экран"}</span></button><button onClick={() => setSettings((value) => !value)}><Settings2 size={20} /><span>Устройства</span></button><button className="voice-leave" onClick={leave}><PhoneOff size={20} /><span>Выйти</span></button></div>{settings ? <label className="device-picker"><span>Микрофон</span><select value={deviceId} onChange={(event) => chooseDevice(event.target.value)}>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Микрофон ${index + 1}`}</option>)}</select></label> : null}</>}</section></div>;
}
