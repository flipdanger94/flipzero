"use client";

import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  LoaderCircle,
  Layers3,
  Mic,
  MicOff,
  MonitorUp,
  Music2,
  PhoneOff,
  Radio,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { ConnectionQuality, Room, RoomEvent, Track } from "livekit-client";

type VoiceStatus = "idle" | "connecting" | "connected" | "reconnecting";
const qualityLabels = {
  [ConnectionQuality.Excellent]: "Отличная",
  [ConnectionQuality.Good]: "Хорошая",
  [ConnectionQuality.Poor]: "Слабая",
  [ConnectionQuality.Lost]: "Нет связи",
  [ConnectionQuality.Unknown]: "Проверка",
};

export function VoiceRoom({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [quality, setQuality] = useState(ConnectionQuality.Unknown);
  const [activeSpeaker, setActiveSpeaker] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [settings, setSettings] = useState(false);
  const [breakout, setBreakout] = useState("main");
  const [soundboard, setSoundboard] = useState(false);
  const [consentPanel, setConsentPanel] = useState(false);
  const [incomingConsent, setIncomingConsent] = useState<{
    id: string;
    requester: string;
  } | null>(null);
  const [consents, setConsents] = useState<
    Record<string, "pending" | "accepted" | "declined">
  >({});
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const localCameraRef = useRef<HTMLDivElement | null>(null);
  const localScreenRef = useRef<HTMLDivElement | null>(null);
  const consentRequestRef = useRef("");

  useEffect(
    () => () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    },
    [channelId],
  );
  function clearMedia(container: HTMLDivElement | null) {
    container?.replaceChildren();
  }
  function attachLocal(source: Track.Source, container: HTMLDivElement | null) {
    clearMedia(container);
    const track =
      roomRef.current?.localParticipant.getTrackPublication(source)?.track;
    if (track && container) container.appendChild(track.attach());
  }

  async function join() {
    setStatus("connecting");
    setError("");
    const response = await fetch(`/api/v1/channels/${channelId}/voice-token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakout }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus("idle");
      setError(data.message ?? "Не удалось подключиться.");
      return;
    }
    try {
      const room = new Room({ adaptiveStream: true, dynacast: true });
      const refresh = () =>
        setParticipantCount(room.remoteParticipants.size + 1);
      room.on(RoomEvent.ParticipantConnected, refresh);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        setActiveSpeaker(speakers[0]?.name || speakers[0]?.identity || ""),
      );
      room.on(RoomEvent.ConnectionQualityChanged, (next, participant) => {
        if (participant.isLocal) setQuality(next);
      });
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic !== "recording-consent") return;
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          if (message.action === "request")
            setIncomingConsent({
              id: String(message.requestId),
              requester: String(
                message.requester || participant?.name || "Участник",
              ),
            });
          if (
            message.action === "response" &&
            message.requestId === consentRequestRef.current &&
            participant
          )
            setConsents((current) => ({
              ...current,
              [participant.identity]: message.accepted
                ? "accepted"
                : "declined",
            }));
        } catch {
          return;
        }
      });
      room.on(RoomEvent.Reconnecting, () => setStatus("reconnecting"));
      room.on(RoomEvent.Reconnected, () => setStatus("connected"));
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio)
          audioRef.current?.appendChild(track.attach());
        if (track.kind === Track.Kind.Video) {
          setRemoteVideo(true);
          window.requestAnimationFrame(() =>
            remoteVideoRef.current?.appendChild(track.attach()),
          );
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        setRemoteVideo(Boolean(remoteVideoRef.current?.childElementCount));
      });
      room.on(RoomEvent.Disconnected, () => {
        setStatus("idle");
        setParticipantCount(0);
        setCamera(false);
        setSharing(false);
        setRemoteVideo(false);
        setActiveSpeaker("");
      });
      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.startAudio();
      roomRef.current = room;
      const microphones = await Room.getLocalDevices("audioinput");
      setDevices(microphones);
      setDeviceId(microphones[0]?.deviceId ?? "");
      refresh();
      setMuted(false);
      setStatus("connected");
    } catch {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setStatus("idle");
      setError("Не удалось установить голосовое соединение.");
    }
  }

  async function chooseDevice(next: string) {
    if (!roomRef.current) return;
    await roomRef.current.switchActiveDevice("audioinput", next);
    setDeviceId(next);
  }
  async function playSound(frequency: number) {
    const room = roomRef.current;
    if (!room) return;
    try {
      const context = new AudioContext();
      const output = context.createMediaStreamDestination();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7);
      const oscillator = context.createOscillator();
      oscillator.type = frequency > 600 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.35,
        context.currentTime + 0.25,
      );
      oscillator.connect(gain).connect(output);
      const mediaTrack = output.stream.getAudioTracks()[0];
      await room.localParticipant.publishTrack(mediaTrack, {
        name: "soundboard",
        source: Track.Source.Unknown,
      });
      oscillator.start();
      oscillator.stop(context.currentTime + 0.7);
      window.setTimeout(() => {
        void room.localParticipant.unpublishTrack(mediaTrack, true);
        void context.close();
      }, 900);
    } catch {
      setError("Не удалось воспроизвести звук в комнате.");
    }
  }
  async function requestRecordingConsent() {
    const room = roomRef.current;
    if (!room) return;
    const requestId = crypto.randomUUID();
    const statuses: Record<string, "pending" | "accepted"> = {
      [room.localParticipant.identity]: "accepted",
    };
    room.remoteParticipants.forEach((participant) => {
      statuses[participant.identity] = "pending";
    });
    consentRequestRef.current = requestId;
    setConsents(statuses);
    setConsentPanel(true);
    await room.localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          action: "request",
          requestId,
          requester: room.localParticipant.name || "Организатор",
        }),
      ),
      { reliable: true, topic: "recording-consent" },
    );
  }
  async function respondToConsent(accepted: boolean) {
    const room = roomRef.current;
    if (!room || !incomingConsent) return;
    await room.localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          action: "response",
          requestId: incomingConsent.id,
          accepted,
        }),
      ),
      { reliable: true, topic: "recording-consent" },
    );
    setIncomingConsent(null);
  }
  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }
  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    const next = !camera;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamera(next);
      if (next)
        window.requestAnimationFrame(() =>
          attachLocal(Track.Source.Camera, localCameraRef.current),
        );
      else clearMedia(localCameraRef.current);
    } catch {
      setError("Не удалось включить камеру.");
    }
  }
  async function toggleScreen() {
    const room = roomRef.current;
    if (!room) return;
    const next = !sharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
      if (next)
        window.requestAnimationFrame(() =>
          attachLocal(Track.Source.ScreenShare, localScreenRef.current),
        );
      else clearMedia(localScreenRef.current);
    } catch {
      setError("Демонстрация экрана отменена или недоступна.");
    }
  }
  function leave() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    [audioRef, remoteVideoRef, localCameraRef, localScreenRef].forEach((ref) =>
      clearMedia(ref.current),
    );
    setStatus("idle");
    setParticipantCount(0);
    setCamera(false);
    setSharing(false);
    setRemoteVideo(false);
    setSettings(false);
    setSoundboard(false);
    setConsentPanel(false);
    setIncomingConsent(null);
    setConsents({});
  }

  const showingVideo = camera || sharing || remoteVideo;
  const connected = status === "connected" || status === "reconnecting";
  return (
    <div className={`voice-room ${showingVideo ? "has-video" : ""}`}>
      <div ref={audioRef} className="remote-audio" />
      {showingVideo ? (
        <div className="video-grid">
          <div ref={remoteVideoRef} className="remote-video" />
          <div
            ref={localScreenRef}
            className={`local-screen ${sharing ? "visible" : ""}`}
          />
          <div
            ref={localCameraRef}
            className={`local-camera ${camera ? "visible" : ""}`}
          />
        </div>
      ) : null}
      <section className="voice-hero">
        <div className={`voice-orb ${connected ? "is-live" : ""}`}>
          <Radio size={38} />
        </div>
        <small>ГОЛОСОВАЯ КОМНАТА</small>
        <h1>{channelName}</h1>
        <p>
          {connected
            ? status === "reconnecting"
              ? "Восстанавливаем соединение..."
              : "Вы в эфире. Можно включить камеру или показать экран."
            : "Подключайтесь к разговору с качественным пространственным звуком."}
        </p>
        {connected ? (
          <div className="voice-status-row">
            <span className="voice-online">
              <Users size={16} /> В комнате: {participantCount}
            </span>
            <span className={`quality quality-${quality}`}>
              <Signal size={15} /> {qualityLabels[quality]}
            </span>
          </div>
        ) : null}
        {activeSpeaker ? (
          <div className="active-speaker">
            <i /> Сейчас говорит: <b>{activeSpeaker}</b>
          </div>
        ) : null}
        {error ? <div className="voice-error">{error}</div> : null}
        {status === "idle" ? (
          <label className="breakout-picker">
            <span>
              <Layers3 size={14} /> Комната
            </span>
            <select
              value={breakout}
              onChange={(event) => setBreakout(event.target.value)}
            >
              <option value="main">Главная</option>
              <option value="focus">Фокус-комната</option>
              <option value="social">Общение</option>
            </select>
          </label>
        ) : null}
        {status === "idle" ? (
          <button className="voice-join" onClick={join}>
            <Headphones size={19} /> Подключиться
          </button>
        ) : status === "connecting" ? (
          <button className="voice-join" disabled>
            <LoaderCircle className="spin" size={19} /> Подключение...
          </button>
        ) : (
          <>
            <div className="voice-controls">
              <button className={muted ? "is-muted" : ""} onClick={toggleMute}>
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{muted ? "Включить" : "Микрофон"}</span>
              </button>
              <button
                className={camera ? "is-active" : ""}
                onClick={toggleCamera}
              >
                {camera ? <VideoOff size={20} /> : <Video size={20} />}
                <span>{camera ? "Выключить" : "Камера"}</span>
              </button>
              <button
                className={sharing ? "is-active" : ""}
                onClick={toggleScreen}
              >
                <MonitorUp size={20} />
                <span>{sharing ? "Остановить" : "Экран"}</span>
              </button>
              <button onClick={() => setSettings((value) => !value)}>
                <Settings2 size={20} />
                <span>Устройства</span>
              </button>
              <button onClick={() => setSoundboard((value) => !value)}>
                <Music2 size={20} />
                <span>Soundboard</span>
              </button>
              <button onClick={requestRecordingConsent}>
                <ShieldCheck size={20} />
                <span>Согласие</span>
              </button>
              <button className="voice-leave" onClick={leave}>
                <PhoneOff size={20} />
                <span>Выйти</span>
              </button>
            </div>
            {settings ? (
              <label className="device-picker">
                <span>Микрофон</span>
                <select
                  value={deviceId}
                  onChange={(event) => chooseDevice(event.target.value)}
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Микрофон ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {soundboard ? (
              <div className="soundboard">
                <button onClick={() => playSound(330)}>✨ Магия</button>
                <button onClick={() => playSound(520)}>🎉 Победа</button>
                <button onClick={() => playSound(180)}>🥁 Удар</button>
                <button onClick={() => playSound(760)}>🔔 Сигнал</button>
              </div>
            ) : null}
            {consentPanel ? (
              <div className="consent-panel">
                <strong>Согласие на запись</strong>
                <span>
                  {
                    Object.values(consents).filter(
                      (value) => value === "accepted",
                    ).length
                  }{" "}
                  из {Object.keys(consents).length} подтвердили
                </span>
                <div>
                  {Object.entries(consents).map(([identity, value]) => (
                    <small key={identity} className={`consent-${value}`}>
                      {identity.slice(0, 8)} ·{" "}
                      {value === "accepted"
                        ? "согласен"
                        : value === "declined"
                          ? "отказался"
                          : "ожидаем"}
                    </small>
                  ))}
                </div>
                {Object.values(consents).some(
                  (value) => value === "declined",
                ) ? (
                  <b>Запись заблокирована: получен отказ.</b>
                ) : Object.values(consents).every(
                    (value) => value === "accepted",
                  ) ? (
                  <b className="consent-ready">
                    Все согласны. Можно запускать запись.
                  </b>
                ) : null}
              </div>
            ) : null}
          </>
        )}
        {incomingConsent ? (
          <div className="consent-request">
            <ShieldCheck size={20} />
            <div>
              <strong>{incomingConsent.requester} запрашивает запись</strong>
              <span>
                Подтвердите согласие на запись и транскрипцию комнаты.
              </span>
            </div>
            <button onClick={() => respondToConsent(true)}>Согласен</button>
            <button onClick={() => respondToConsent(false)}>Отказаться</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
