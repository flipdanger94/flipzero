"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, MicOff, PhoneOff, Video, VideoOff, X } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { MediaImage } from "./media-image";

type CallPerson = { id: string; displayName: string; avatarUrl?: string | null };

export function DirectCallOverlay({ person, video, onClose }: { person: CallPerson; video: boolean; onClose: () => void }) {
  const [status, setStatus] = useState("Подключаемся…");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(video);
  const roomRef = useRef<Room | null>(null);
  const remoteRef = useRef<HTMLDivElement | null>(null);
  const localRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const clearVideo = (container: HTMLDivElement | null) => container?.replaceChildren();
    const attachLocal = () => {
      clearVideo(localRef.current);
      const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (track && localRef.current) localRef.current.appendChild(track.attach());
    };
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach());
      if (track.kind === Track.Kind.Video && remoteRef.current) {
        clearVideo(remoteRef.current);
        remoteRef.current.appendChild(track.attach());
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
    room.on(RoomEvent.ParticipantConnected, () => setStatus("На связи"));
    room.on(RoomEvent.ParticipantDisconnected, () => setStatus("Собеседник вышел"));
    room.on(RoomEvent.LocalTrackPublished, (publication) => { if (publication.source === Track.Source.Camera) attachLocal(); });
    room.on(RoomEvent.Disconnected, () => setStatus("Звонок завершён"));

    void (async () => {
      try {
        const response = await fetch("/api/v1/direct-calls/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ receiverId: person.id, video }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Не удалось начать звонок.");
        if (cancelled) return;
        await room.connect(data.url, data.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (video) await room.localParticipant.setCameraEnabled(true);
        if (cancelled) return;
        setStatus(room.remoteParticipants.size ? "На связи" : "Ожидаем собеседника…");
        attachLocal();
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось начать звонок.");
      }
    })();

    return () => {
      cancelled = true;
      void room.disconnect();
      roomRef.current = null;
    };
  }, [person.id, video]);

  async function toggleMic() {
    const room = roomRef.current; if (!room) return;
    const next = !muted;
    try { await room.localParticipant.setMicrophoneEnabled(!next); setMuted(next); } catch { setError("Не удалось переключить микрофон."); }
  }
  async function toggleCamera() {
    const room = roomRef.current; if (!room) return;
    const next = !camera;
    try { await room.localParticipant.setCameraEnabled(next); setCamera(next); } catch { setError("Не удалось переключить камеру."); }
  }

  return <div className="direct-call-backdrop" role="presentation">
    <section className="direct-call-dialog" role="dialog" aria-modal="true" aria-label={video ? "Видеозвонок" : "Голосовой звонок"}>
      <button className="direct-call-close" onClick={onClose} aria-label="Закрыть звонок"><X size={20}/></button>
      <div className="direct-call-stage">
        <div className="direct-call-remote" ref={remoteRef}>
          <span className="direct-call-avatar">{person.avatarUrl ? <MediaImage src={person.avatarUrl}/> : person.displayName.slice(0,2).toLocaleUpperCase("ru")}</span>
          <strong>{person.displayName}</strong><small>{error || status}</small>
          {!error && status === "Подключаемся…" ? <LoaderCircle className="spin" size={22}/> : null}
        </div>
        {video ? <div className="direct-call-local" ref={localRef}/> : null}
        <div ref={audioRef} hidden />
      </div>
      <footer>
        <button className={muted ? "is-off" : ""} onClick={()=>void toggleMic()} aria-label={muted ? "Включить микрофон" : "Выключить микрофон"}>{muted?<MicOff/>:<Mic/>}</button>
        {video ? <button className={!camera ? "is-off" : ""} onClick={()=>void toggleCamera()} aria-label={camera ? "Выключить камеру" : "Включить камеру"}>{camera?<Video/>:<VideoOff/>}</button> : null}
        <button className="hangup" onClick={onClose} aria-label="Завершить звонок"><PhoneOff/></button>
      </footer>
    </section>
  </div>;
}
