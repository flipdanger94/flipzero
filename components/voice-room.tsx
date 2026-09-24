"use client";

import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  LoaderCircle,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
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
  Volume2,
  VolumeX,
} from "lucide-react";
import { ConnectionQuality, Room, RoomEvent, Track } from "livekit-client";
import { MediaImage } from "./media-image";
import { normalizeVoicePresence, type VoicePresence } from "@/lib/voice-presence";

type VoiceStatus = "idle" | "connecting" | "connected" | "reconnecting";
export type { VoicePresence } from "@/lib/voice-presence";
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
  autoJoin = false,
  presence = [],
  initialStreamId = "",
  spaceName = "",
  onPresenceChange,
}: {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
  presence?: VoicePresence[];
  initialStreamId?: string;
  spaceName?: string;
  onPresenceChange?: (participants: VoicePresence[]) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceChecked, setVoiceChecked] = useState(false);
  const [voiceCheckNonce, setVoiceCheckNonce] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [camera, setCamera] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState(initialStreamId);
  const [focusMode, setFocusMode] = useState(Boolean(initialStreamId));
  const [streamMuted, setStreamMuted] = useState(false);
  const [streamVolume, setStreamVolume] = useState(100);
  const [participantCount, setParticipantCount] = useState(0);
  const [quality, setQuality] = useState(ConnectionQuality.Unknown);
  const [activeSpeaker, setActiveSpeaker] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDeviceId, setOutputDeviceId] = useState("");
  const [settings, setSettings] = useState(false);
  const breakout = "main";
  const [soundboard, setSoundboard] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const screenSupported = typeof navigator === "undefined" || Boolean(navigator.mediaDevices?.getDisplayMedia);
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
  const deafenedRef = useRef(false);
  const joinAttemptRef = useRef(0);
  const soundPlayingRef = useRef(false);
  const speakingRef = useRef(false);
  const joinRef = useRef<() => Promise<void>>(async () => {});
  const outputVolumeRef = useRef(1);
  const voiceRootRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      joinAttemptRef.current++;
      roomRef.current?.disconnect();
      roomRef.current = null;
    },
    [channelId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/voice/status?check=1", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Voice status failed"); return response.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        const available = Boolean(data.available) && data.connection === "ok";
        setVoiceAvailable(available);
        setVoiceChecked(data.connection === "ok");
        setVoiceMessage(data.connection === "invalid_url" ? "Адрес голосового сервера указан неверно. Проверьте LIVEKIT_URL в Vercel."
          : data.connection === "unreachable" ? "Сервер голосовой связи не отвечает или ключи неверны. Проверьте настройки LiveKit в Vercel."
          : "Голосовые комнаты пока недоступны. Попробуйте позже.");
        if (available && autoJoin) void joinRef.current();
      })
      .catch(() => { if (!controller.signal.aborted) { setVoiceAvailable(true); setVoiceChecked(false); } });
    return () => controller.abort();
  }, [autoJoin, voiceCheckNonce]);
  function clearMedia(container: HTMLDivElement | null) {
    container?.replaceChildren();
  }
  function attachLocal(source: Track.Source, container: HTMLDivElement | null) {
    clearMedia(container);
    const track =
      roomRef.current?.localParticipant.getTrackPublication(source)?.track;
    if (track && container) container.appendChild(track.attach());
  }
  function attachStreamPreview(participantId: string, track: Track) {
    const attach = () => {
      const targets = voiceRootRef.current?.querySelectorAll<HTMLDivElement>("[data-stream-preview-id]");
      const target = targets ? [...targets].find((element) => element.dataset.streamPreviewId === participantId) : null;
      if (!target) return false;
      clearMedia(target);
      const preview = track.attach();
      preview.dataset.participantId = participantId;
      preview.dataset.preview = "voice-tile";
      if (preview instanceof HTMLVideoElement) {
        preview.muted = true;
        preview.playsInline = true;
      }
      target.appendChild(preview);
      return true;
    };
    if (!attach()) window.setTimeout(attach, 120);
  }
  function clearStreamPreview(participantId: string) {
    const targets = voiceRootRef.current?.querySelectorAll<HTMLDivElement>("[data-stream-preview-id]");
    const target = targets ? [...targets].find((element) => element.dataset.streamPreviewId === participantId) : null;
    clearMedia(target ?? null);
  }
  function emitVoiceSession(connected: boolean, nextQuality = quality) {
    window.dispatchEvent(new CustomEvent("flipzero:voice-session", { detail: {
      connected, channelId, channelName, spaceName, quality: qualityLabels[nextQuality] ?? "Проверка",
    } }));
  }
  function playVoiceCue(kind: "join" | "leave") {
    try {
      if (localStorage.getItem("flipzero:voice-sounds") === "off") return;
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = kind === "join" ? 520 : 300;
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.onended = () => void context.close();
    } catch {}
  }

  async function join() {
    if (status !== "idle") return;
    const attempt = ++joinAttemptRef.current;
    setStatus("connecting");
    setError("");
    let room: Room | null = null;
    let connectTimeout: number | undefined;
    try {
      const presenceResponse = await fetch(`/api/v1/channels/${channelId}/voice`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ breakout }) });
      const presenceData = await presenceResponse.json().catch(() => null);
      if (!presenceResponse.ok) { setError(presenceData?.message ?? "Нет доступа к голосовому каналу."); setStatus("idle"); return; }
      const response = await fetch(`/api/v1/channels/${channelId}/voice-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ breakout }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (attempt !== joinAttemptRef.current) return;
      if (!response.ok) { setError(data.message ?? "Не удалось подключиться."); setStatus("idle"); return; }
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        autoSubscribe: false,
        publishDefaults: { simulcast: true },
      });
      const connectedRoom = room;
      roomRef.current = room;
      const refresh = () => {
        const participants = [connectedRoom.localParticipant, ...connectedRoom.remoteParticipants.values()];
        setParticipantCount(participants.length);
        onPresenceChange?.(normalizeVoicePresence(participants.map((participant) => ({
          id: participant.identity,
          name: participant.name || participant.identity,
          muted: !participant.isMicrophoneEnabled,
          deafened: participant.attributes?.deafened === "true",
          camera: participant.isCameraEnabled,
          sharing: participant.isScreenShareEnabled,
          streaming: participant.isScreenShareEnabled,
          speaking: participant.isSpeaking,
        }))));
      };
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeaker(speakers[0]?.name || speakers[0]?.identity || "");
        speakingRef.current = speakers.some((participant) => participant.isLocal);
        refresh();
      });
      const subscribeDefaultTrack = (publication: { source: Track.Source; setSubscribed: (subscribed: boolean) => void }) => {
        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) return;
        publication.setSubscribed(true);
      };
      const subscribeParticipantDefaults = (participant: { trackPublications: Map<string, { source: Track.Source; setSubscribed: (subscribed: boolean) => void }> }) => {
        participant.trackPublications.forEach((publication) => subscribeDefaultTrack(publication));
      };
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.ParticipantMetadataChanged, refresh);
      room.on(RoomEvent.ParticipantAttributesChanged, refresh);
      room.on(RoomEvent.TrackPublished, (publication) => { subscribeDefaultTrack(publication); refresh(); });
      room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
          clearStreamPreview(participant.identity);
          remoteVideoRef.current?.querySelectorAll(`[data-participant-id="${participant.identity}"]`).forEach((element) => element.remove());
          setSelectedStreamId((current) => {
            if (current !== participant.identity) return current;
            setFocusMode(false);
            return "";
          });
        }
        refresh();
      });
      room.on(RoomEvent.ParticipantConnected, (participant) => { subscribeParticipantDefaults(participant); refresh(); });
      room.on(RoomEvent.ConnectionQualityChanged, (next, participant) => {
        if (participant.isLocal) { setQuality(next); emitVoiceSession(true, next); }
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
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.dataset.participantId = participant.identity;
          if (element instanceof HTMLAudioElement) { element.muted = deafenedRef.current; element.volume = outputVolumeRef.current; }
          audioRef.current?.appendChild(element);
        }
        if (track.kind === Track.Kind.Video) {
          const element = track.attach();
          element.dataset.source = track.source;
          element.dataset.participantId = participant.identity;
          remoteVideoRef.current?.appendChild(element);
          if (track.source === Track.Source.ScreenShare) attachStreamPreview(participant.identity, track);
          setRemoteVideo(true);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        setRemoteVideo(Boolean(remoteVideoRef.current?.childElementCount));
      });
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.source === Track.Source.Camera) {
          setCamera(true);
          attachLocal(Track.Source.Camera, localCameraRef.current);
        }
        if (publication.source === Track.Source.ScreenShare) {
          setSharing(true);
          attachLocal(Track.Source.ScreenShare, localScreenRef.current);
          if (publication.track) attachStreamPreview(connectedRoom.localParticipant.identity, publication.track);
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.Camera) {
          setCamera(false);
          clearMedia(localCameraRef.current);
        }
        if (publication.source === Track.Source.ScreenShare) {
          setSharing(false);
          clearMedia(localScreenRef.current);
          clearStreamPreview(connectedRoom.localParticipant.identity);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== connectedRoom) return;
        roomRef.current = null;
        setStatus("idle");
        setParticipantCount(0);
        setCamera(false);
        setSharing(false);
        setRemoteVideo(false);
        setActiveSpeaker("");
        onPresenceChange?.([]);
        emitVoiceSession(false);
        playVoiceCue("leave");
        void fetch(`/api/v1/channels/${channelId}/voice`, { method: "DELETE" });
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!connectedRoom.canPlaybackAudio));
      room.on(RoomEvent.MediaDevicesError, (mediaError) => {
        setError(`Ошибка устройства: ${String(mediaError || "не удалось получить доступ к микрофону или камере")}`);
      });
      await Promise.race([
        room.connect(data.url, data.token, { websocketTimeout: 10000, peerConnectionTimeout: 10000, maxRetries: 1 }),
        new Promise<never>((_, reject) => {
          connectTimeout = window.setTimeout(() => reject(new Error("VOICE_CONNECTION_TIMEOUT")), 20000);
        }),
      ]);
      window.clearTimeout(connectTimeout);
      if (attempt !== joinAttemptRef.current) { void room.disconnect(); return; }
      connectedRoom.remoteParticipants.forEach((participant) => subscribeParticipantDefaults(participant));
      let audioPrefs: { inputId?: string; outputId?: string; inputVolume?: number; outputVolume?: number; inputProfile?: "standard"|"noise"|"raw" } = {};
      try { audioPrefs = JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}"); } catch { audioPrefs = {}; }
      outputVolumeRef.current = Math.max(0, Math.min(1, Number(audioPrefs.outputVolume ?? 100) / 100));
      const [microphones, speakers] = await Promise.all([Room.getLocalDevices("audioinput").catch(() => []), Room.getLocalDevices("audiooutput").catch(() => [])]);
      if (attempt !== joinAttemptRef.current) { void room.disconnect(); return; }
      const preferredInput = microphones.some((item) => item.deviceId === audioPrefs.inputId) ? audioPrefs.inputId : undefined;
      const preferredOutput = speakers.some((item) => item.deviceId === audioPrefs.outputId) ? audioPrefs.outputId : undefined;
      const microphoneOptions = {
        ...(preferredInput ? { deviceId: preferredInput } : {}),
        echoCancellation: audioPrefs.inputProfile !== "raw",
        noiseSuppression: audioPrefs.inputProfile === "noise",
        autoGainControl: audioPrefs.inputProfile !== "raw",
      };
      try {
        await room.localParticipant.setMicrophoneEnabled(true, microphoneOptions);
        setMuted(false);
        setError("");
      } catch {
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: audioPrefs.inputProfile !== "raw",
            noiseSuppression: audioPrefs.inputProfile === "noise",
            autoGainControl: audioPrefs.inputProfile !== "raw",
          });
          setMuted(false);
          setError("");
        } catch {
          setMuted(true);
          setError("Микрофон недоступен. Разрешите доступ в настройках браузера и нажмите «Включить».");
        }
      }
      try { await room.startAudio(); } catch { setAudioBlocked(true); }
      setAudioBlocked(!room.canPlaybackAudio);
      if (preferredInput) await room.switchActiveDevice("audioinput", preferredInput).catch(() => {});
      if (preferredOutput) await room.switchActiveDevice("audiooutput", preferredOutput).catch(() => {});
      setDevices(microphones);
      setDeviceId(room.getActiveDevice("audioinput") ?? preferredInput ?? microphones[0]?.deviceId ?? "");
      setOutputDevices(speakers);
      setOutputDeviceId(room.getActiveDevice("audiooutput") ?? preferredOutput ?? speakers[0]?.deviceId ?? "");
      refresh();
      setStatus("connected");
      if (initialStreamId) focusStream(initialStreamId);
      emitVoiceSession(true);
      playVoiceCue("join");
    } catch (cause) {
      if (room) void room.disconnect();
      void fetch(`/api/v1/channels/${channelId}/voice`, { method: "DELETE" });
      if (roomRef.current === room) roomRef.current = null;
      if (attempt !== joinAttemptRef.current) return;
      setStatus("idle");
      setError(cause instanceof Error && cause.message === "VOICE_CONNECTION_TIMEOUT"
        ? "Сервер голосовой связи не ответил вовремя. Проверьте настройки LiveKit или попробуйте ещё раз."
        : "Не удалось установить голосовое соединение. Проверьте сеть и настройки LiveKit.");
    } finally {
      window.clearTimeout(connectTimeout);
    }
  }
  useEffect(() => { joinRef.current = join; });
  useEffect(() => {
    function handleVoiceControl(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const room = roomRef.current;
      if (!room) return;
      if (detail.type === "toggle-mic") {
        const nextMuted = Boolean(detail.muted);
        void room.localParticipant.setMicrophoneEnabled(!nextMuted).then(() => setMuted(nextMuted)).catch(() => setError("Не удалось переключить микрофон."));
      }
      if (detail.type === "toggle-output") {
        const nextDeafened = Boolean(detail.deafened);
        deafenedRef.current = nextDeafened;
        audioRef.current?.querySelectorAll("audio").forEach((audio) => { audio.muted = nextDeafened; });
        setDeafened(nextDeafened);
      }
      if (detail.type === "input-device" && typeof detail.deviceId === "string") {
        void room.switchActiveDevice("audioinput", detail.deviceId).then(() => setDeviceId(detail.deviceId as string)).catch(() => setError("Не удалось переключить микрофон."));
      }
      if (detail.type === "output-device" && typeof detail.deviceId === "string") {
        void room.switchActiveDevice("audiooutput", detail.deviceId).then(() => setOutputDeviceId(detail.deviceId as string)).catch(() => setError("Не удалось переключить устройство вывода."));
      }
      if (detail.type === "output-volume") {
        const volume = Math.max(0, Math.min(1, Number(detail.value ?? 100) / 100));
        outputVolumeRef.current = volume;
        audioRef.current?.querySelectorAll("audio").forEach((audio) => { audio.volume = volume; });
      }
      if (detail.type === "participant-volume" && typeof detail.participantId === "string") {
        const volume = Math.max(0, Math.min(1, Number(detail.value ?? 100) / 100));
        audioRef.current?.querySelectorAll<HTMLAudioElement>(`audio[data-participant-id="${detail.participantId}"]`).forEach((audio) => { audio.volume = volume; });
      }
      if (detail.type === "leave") {
        leave();
      }
      if (detail.type === "input-profile") {
        const profile = detail.profile;
        if (profile === "standard" || profile === "noise" || profile === "raw") {
          const prefs = (() => { try { return JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}"); } catch { return {}; } })();
          void room.localParticipant.setMicrophoneEnabled(true, {
            ...(prefs.inputId ? { deviceId: prefs.inputId } : {}),
            echoCancellation: profile !== "raw",
            noiseSuppression: profile === "noise",
            autoGainControl: profile !== "raw",
          }).catch(() => setError("Не удалось применить профиль микрофона."));
        }
      }
    }
    window.addEventListener("flipzero:voice-control", handleVoiceControl);
    return () => window.removeEventListener("flipzero:voice-control", handleVoiceControl);
  }, []);


  useEffect(() => {
    if (status !== "connected" && status !== "reconnecting") return;
    const heartbeat = () => {
      void fetch(`/api/v1/channels/${channelId}/voice`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heartbeat: true }),
        keepalive: true,
      });
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 45_000);
    const pagehide = () => {
      navigator.sendBeacon?.(`/api/v1/channels/${channelId}/voice?leave=1`, new Blob([], { type: "text/plain" }));
    };
    window.addEventListener("pagehide", pagehide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [channelId, status]);

  useEffect(() => {
    if (status !== "connected" && status !== "reconnecting") return;
    const refreshToken = async () => {
      const response = await fetch(`/api/v1/channels/${channelId}/voice-token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ breakout }),
      }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json();
      const currentRoom = roomRef.current as (Room & { updateToken?: (token: string) => Promise<void> }) | null;
      if (currentRoom?.updateToken) await currentRoom.updateToken(data.token).catch(() => undefined);
    };
    const timer = window.setInterval(() => void refreshToken(), 90 * 60_000);
    return () => window.clearInterval(timer);
  }, [channelId, status]);


  async function chooseDevice(next: string) {
    if (!roomRef.current) return;
    try { await roomRef.current.switchActiveDevice("audioinput", next); setDeviceId(next); saveDevicePreference("inputId", next); setError(""); }
    catch { setError("Не удалось переключить микрофон."); }
  }
  async function chooseOutput(next: string) {
    if (!roomRef.current) return;
    try { await roomRef.current.switchActiveDevice("audiooutput", next); setOutputDeviceId(next); saveDevicePreference("outputId", next); setError(""); }
    catch { setError("Не удалось переключить динамик. Выберите устройство в настройках телефона или браузера."); }
  }
  function saveDevicePreference(key: "inputId" | "outputId", value: string) {
    try { const current = JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}"); localStorage.setItem("flipzero:audio-devices:v1", JSON.stringify({ ...current, [key]: value })); } catch {}
  }
  async function toggleDeafen() {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    audioRef.current?.querySelectorAll("audio").forEach((audio) => { audio.muted = next; });
    setDeafened(next);
    await roomRef.current?.localParticipant.setAttributes({ deafened: String(next) }).catch(() => undefined);
    void fetch(`/api/v1/channels/${channelId}/voice`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selfDeafened: next }) });
  }
  async function enableAudio() {
    const room = roomRef.current;
    if (!room) return;
    try { await room.startAudio(); setAudioBlocked(!room.canPlaybackAudio); }
    catch { setError("Браузер не разрешил воспроизведение. Нажмите ещё раз или проверьте звук устройства."); }
  }
  async function playSound(frequency: number) {
    const room = roomRef.current;
    if (!room || soundPlayingRef.current) return;
    soundPlayingRef.current = true;
    setSoundPlaying(true);
    let context: AudioContext | null = null;
    let mediaTrack: MediaStreamTrack | null = null;
    try {
      context = new AudioContext();
      await context.resume();
      const output = context.createMediaStreamDestination();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.2);
      const oscillator = context.createOscillator();
      oscillator.type = frequency > 600 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.35,
        context.currentTime + 0.5,
      );
      oscillator.connect(gain).connect(output);
      gain.connect(context.destination);
      mediaTrack = output.stream.getAudioTracks()[0];
      await room.localParticipant.publishTrack(mediaTrack, {
        name: "soundboard",
        source: Track.Source.Unknown,
      });
      oscillator.start();
      oscillator.stop(context.currentTime + 1.2);
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1800);
        oscillator.onended = () => { window.clearTimeout(timeout); resolve(); };
      });
    } catch {
      setError("Не удалось воспроизвести звук в комнате.");
    } finally {
      if (mediaTrack) {
        await room.localParticipant.unpublishTrack(mediaTrack, true).catch(() => {});
        mediaTrack.stop();
      }
      if (context) await context.close().catch(() => {});
      soundPlayingRef.current = false;
      setSoundPlaying(false);
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
    try {
      if (next) {
        await room.localParticipant.setMicrophoneEnabled(false);
      } else {
        const microphones = await Room.getLocalDevices("audioinput").catch(() => []);
        let prefs: { inputId?: string; inputProfile?: "standard"|"noise"|"raw" } = {};
        try { prefs = JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}"); } catch { prefs = {}; }
        const preferredInput = microphones.some((item) => item.deviceId === prefs.inputId) ? prefs.inputId : undefined;
        await room.localParticipant.setMicrophoneEnabled(true, {
          ...(preferredInput ? { deviceId: preferredInput } : {}),
          echoCancellation: prefs.inputProfile !== "raw",
          noiseSuppression: prefs.inputProfile === "noise",
          autoGainControl: prefs.inputProfile !== "raw",
        });
        setDeviceId(room.getActiveDevice("audioinput") ?? preferredInput ?? microphones[0]?.deviceId ?? "");
      }
      setMuted(next);
      void fetch(`/api/v1/channels/${channelId}/voice`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selfMuted: next }) });
      setError("");
    } catch { setError("Не удалось включить микрофон. Разрешите доступ в настройках браузера."); }
  }
  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    const next = !camera;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamera(next);
      if (next) attachLocal(Track.Source.Camera, localCameraRef.current);
      else clearMedia(localCameraRef.current);
      setError("");
    } catch {
      setError("Не удалось включить камеру. Проверьте разрешение браузера и доступ к устройству.");
    }
  }
  async function toggleScreen() {
    const room = roomRef.current;
    if (!room) return;
    if (!screenSupported) { setError("Демонстрация экрана недоступна в этом браузере. Откройте FlipZero на компьютере."); return; }
    const next = !sharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
      void fetch(`/api/v1/channels/${channelId}/voice`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ streaming: next }) });
      if (next) attachLocal(Track.Source.ScreenShare, localScreenRef.current);
      else clearMedia(localScreenRef.current);
      setError("");
    } catch {
      setError("Демонстрация экрана отменена или недоступна.");
    }
  }
  function leave() {
    joinAttemptRef.current++;
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    void fetch(`/api/v1/channels/${channelId}/voice`, { method: "DELETE" });
    emitVoiceSession(false);
    playVoiceCue("leave");
    [audioRef, remoteVideoRef, localCameraRef, localScreenRef].forEach((ref) =>
      clearMedia(ref.current),
    );
    setStatus("idle");
    setParticipantCount(0);
    setCamera(false);
    setSharing(false);
    setRemoteVideo(false);
    setMuted(false);
    setAudioBlocked(false);
    setDeafened(false);
    deafenedRef.current = false;
    setActiveSpeaker("");
    speakingRef.current = false;
    setQuality(ConnectionQuality.Unknown);
    setSettings(false);
    setSoundboard(false);
    setConsentPanel(false);
    setIncomingConsent(null);
    setConsents({});
    onPresenceChange?.([]);
  }

  const normalizedPresence = normalizeVoicePresence(presence);
  const streamingParticipants = normalizedPresence.filter((participant) => participant.streaming || participant.sharing);
  const visibleParticipants = normalizedPresence.slice(0, 50);
  const hiddenParticipantCount = Math.max(0, normalizedPresence.length - visibleParticipants.length);
  const showingVideo = camera || sharing || remoteVideo;
  const connected = status === "connected" || status === "reconnecting";
  const selectedStream = streamingParticipants.find((participant) => participant.id === selectedStreamId) ?? streamingParticipants[0] ?? null;

  function focusStream(participantId: string) {
    const room = roomRef.current;
    const participant = room?.remoteParticipants.get(participantId);
    participant?.trackPublications.forEach((publication) => {
      if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) publication.setSubscribed(true);
    });
    setSelectedStreamId(participantId);
    setFocusMode(true);
    remoteVideoRef.current?.querySelectorAll<HTMLElement>("[data-participant-id]").forEach((element) => {
      element.hidden = element.dataset.participantId !== participantId;
    });
    requestAnimationFrame(() => remoteVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  function minimizeStream() {
    setFocusMode(false);
  }
  function clearFocus() {
    const previous = selectedStreamId;
    const participant = roomRef.current?.remoteParticipants.get(previous);
    participant?.trackPublications.forEach((publication) => {
      if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) publication.setSubscribed(false);
    });
    remoteVideoRef.current?.querySelectorAll<HTMLElement>(`[data-participant-id="${previous}"]`).forEach((element) => element.remove());
    clearStreamPreview(previous);
    setFocusMode(false);
    setSelectedStreamId("");
    remoteVideoRef.current?.querySelectorAll<HTMLElement>("[data-participant-id]").forEach((element) => { element.hidden = false; });
    setRemoteVideo(Boolean(remoteVideoRef.current?.childElementCount));
  }
  function applyStreamVolume() {
    if (!selectedStreamId) return;
    audioRef.current?.querySelectorAll<HTMLAudioElement>(`audio[data-participant-id="${selectedStreamId}"]`).forEach((audio) => {
      audio.muted = streamMuted || deafenedRef.current;
      audio.volume = Math.max(0, Math.min(1, streamVolume / 100));
    });
  }
  useEffect(() => { applyStreamVolume(); }, [selectedStreamId, streamMuted, streamVolume]);
  useEffect(() => {
    if (!initialStreamId || !remoteVideo) return;
    remoteVideoRef.current?.querySelectorAll<HTMLElement>("[data-participant-id]").forEach((element) => {
      element.hidden = element.dataset.participantId !== initialStreamId;
    });
    remoteVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initialStreamId, remoteVideo]);
  async function toggleFullscreen() {
    const root = voiceRootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch { setError("Полноэкранный режим недоступен в этом браузере."); }
  }
  async function openPictureInPicture() {
    const selector = selectedStreamId ? `video[data-participant-id="${selectedStreamId}"]` : "video";
    const video = remoteVideoRef.current?.querySelector<HTMLVideoElement>(selector);
    const pipVideo = video as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null | undefined;
    if (!pipVideo || typeof pipVideo.requestPictureInPicture !== "function") { setError("Картинка в картинке недоступна для этого стрима."); return; }
    try { await pipVideo.requestPictureInPicture(); } catch { setError("Не удалось открыть картинку в картинке."); }
  }

  if (!connected) return (
    <div ref={voiceRootRef} className="voice-room voice-room-idle">
      <section className="voice-join-screen">
        <div className="voice-orb"><Radio size={38}/></div>
        <small>ГОЛОСОВОЙ КАНАЛ</small>
        <h1>{channelName}</h1>
        <p>{status === "connecting" ? "Подключаемся к голосовой комнате…" : "Подключайтесь к разговору. Участники и активные стримы отображаются прямо в канале."}</p>
        {voiceAvailable === false ? <div className="voice-unavailable" role="status">{voiceMessage}<button type="button" onClick={() => { setVoiceAvailable(null); setVoiceCheckNonce((value) => value + 1); }}>Проверить ещё раз</button></div> : null}
        {error ? <div className="voice-error">{error}</div> : null}
        <button className="voice-join" onClick={join} disabled={status === "connecting" || voiceAvailable === null}>
          {status === "connecting" || voiceAvailable === null ? <><LoaderCircle className="spin" size={19}/> Подключение…</> : <><Headphones size={19}/> Подключиться</>}
        </button>
      </section>
    </div>
  );

  return (
    <div ref={voiceRootRef} className={`voice-room voice-room-connected ${focusMode ? "is-focus" : ""} ${selectedStreamId && !focusMode ? "has-mini-stream" : ""} ${showingVideo ? "has-video" : ""}`}>
      <div ref={audioRef} className="remote-audio"/>
      <header className="voice-room-topbar">
        <div><small>ГОЛОСОВОЙ КАНАЛ</small><strong>{channelName}</strong>{spaceName ? <span>{spaceName}</span> : null}</div>
        <div className="voice-room-health">
          <span className={`quality quality-${quality}`}><Signal size={14}/>{status === "reconnecting" ? "Переподключение…" : qualityLabels[quality]}</span>
          <span><Users size={14}/>{normalizedPresence.length}</span>
        </div>
      </header>

      <main className="voice-stage-layout">
        <section className="voice-stage-main" aria-label="Сцена голосового канала" onTouchStart={(event)=>{swipeStartRef.current=event.touches[0]?.clientY??null}} onTouchEnd={(event)=>{const start=swipeStartRef.current;const end=event.changedTouches[0]?.clientY;if(focusMode&&start!==null&&typeof end==="number"&&end-start>80)minimizeStream();swipeStartRef.current=null}}>
          {showingVideo ? <div className={`video-grid ${focusMode ? "focus-stream" : ""} ${camera && !sharing && !remoteVideo ? "camera-only" : ""}`}>
            <div ref={remoteVideoRef} className="remote-video"/>
            <div ref={localScreenRef} className={`local-screen ${sharing ? "visible" : ""}`}/>
            <div ref={localCameraRef} className={`local-camera ${camera ? "visible" : ""}`}/>
          </div> : <div className="voice-stage-empty" aria-hidden="true" />}

          {focusMode && selectedStream ? <div className="voice-stream-toolbar">
            <strong><span className="voice-live-badge">LIVE</span>{selectedStream.name}</strong>
            <label aria-label="Громкость стрима"><Volume2 size={15}/><input type="range" min="0" max="100" value={streamVolume} onChange={(event)=>setStreamVolume(Number(event.target.value))}/></label>
            <button type="button" onClick={()=>setStreamMuted((value)=>!value)} aria-label={streamMuted ? "Включить звук стрима" : "Выключить звук стрима"}>{streamMuted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button>
            <button type="button" onClick={()=>void openPictureInPicture()} aria-label="Картинка в картинке"><MonitorUp size={17}/></button>
            <button type="button" onClick={()=>void toggleFullscreen()} aria-label="Полноэкранный режим"><Maximize2 size={17}/></button>
            <button type="button" onClick={minimizeStream} aria-label="Свернуть стрим"><Minimize2 size={17}/></button>
            <button type="button" onClick={clearFocus} aria-label="Закрыть просмотр стрима">×</button>
          </div> : null}

          {selectedStreamId && !focusMode ? <div className="voice-mini-stream-controls" aria-label="Мини-плеер стрима"><button type="button" onClick={()=>setFocusMode(true)} aria-label="Развернуть стрим"><Maximize2 size={16}/></button><button type="button" onClick={clearFocus} aria-label="Закрыть стрим">×</button></div>:null}
          <div className="voice-tile-grid" role="list" aria-label="Участники">
            {visibleParticipants.map((participant)=><article key={participant.id} role="listitem" className={`voice-tile ${participant.speaking ? "speaking" : ""} ${participant.streaming || participant.sharing ? "is-streaming" : ""}`}>
              {participant.streaming || participant.sharing ? <div className="voice-tile-stream-preview" data-stream-preview-id={participant.id} aria-hidden="true" /> : null}
              <div className="voice-tile-avatar">{participant.avatarUrl?<MediaImage src={participant.avatarUrl}/>:participant.name.slice(0,2).toLocaleUpperCase("ru")}</div>
              <footer className="voice-tile-footer"><strong title={participant.name}>{participant.name}</strong><span>{participant.streaming || participant.sharing ? <b className="voice-live-badge">LIVE</b> : null}{participant.muted?<MicOff size={14}/>:null}{participant.deafened?<Headphones size={14}/>:null}{participant.camera?<Video size={14}/>:null}</span></footer>
              {participant.streaming || participant.sharing ? <button type="button" className="voice-tile-watch" onClick={()=>focusStream(participant.id)} aria-label={`Смотреть стрим ${participant.name}`}>Смотреть стрим</button>:null}
            </article>)}
            {hiddenParticipantCount ? <article className="voice-tile voice-tile-more" role="listitem"><strong>+{hiddenParticipantCount}</strong><span>ещё участников</span></article>:null}
          </div>
          {streamingParticipants.length > 1 ? <div className="voice-stream-switcher" aria-label="Активные стримы">{streamingParticipants.map((participant)=><button type="button" className={selectedStreamId===participant.id?"active":""} key={participant.id} onClick={()=>focusStream(participant.id)}><span className="voice-live-badge">LIVE</span>{participant.name}</button>)}</div>:null}
          {activeSpeaker || audioBlocked || error ? <div className="voice-stage-notices">{activeSpeaker ? <div className="active-speaker"><i/>Говорит: <b>{activeSpeaker}</b></div>:null}{audioBlocked ? <button className="voice-enable-audio" onClick={enableAudio}><Headphones size={18}/>Включить звук</button>:null}{error ? <div className="voice-error">{error}</div>:null}</div>:null}
          <div className="voice-secondary-toolbar" aria-label="Дополнительные инструменты">
            <button type="button" className={settings?"active":""} onClick={()=>setSettings((value)=>!value)} aria-label="Устройства"><Settings2 size={18}/><span>Устройства</span></button>
            <button type="button" className={soundboard?"active":""} onClick={()=>setSoundboard((value)=>!value)} aria-label="Soundboard"><Music2 size={18}/><span>Soundboard</span></button>
            <button type="button" onClick={requestRecordingConsent} aria-label="Согласие на запись"><ShieldCheck size={18}/><span>Согласие</span></button>
          </div>
          {settings ? <div className="voice-device-settings voice-inline-panel">
            <label className="device-picker"><span>Микрофон</span><select value={deviceId} onChange={(event)=>void chooseDevice(event.target.value)} disabled={!devices.length}>{!devices.length?<option value="">Микрофон недоступен</option>:devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Микрофон ${index+1}`}</option>)}</select></label>
            <label className="device-picker"><span>Динамики / наушники</span><select value={outputDeviceId} onChange={(event)=>void chooseOutput(event.target.value)} disabled={!outputDevices.length}>{!outputDevices.length?<option value="">Системное устройство</option>:outputDevices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Устройство ${index+1}`}</option>)}</select></label>
          </div>:null}
          {soundboard ? <div className="soundboard voice-inline-panel"><button disabled={soundPlaying} onClick={()=>playSound(330)}>✨ Магия</button><button disabled={soundPlaying} onClick={()=>playSound(520)}>🎉 Победа</button><button disabled={soundPlaying} onClick={()=>playSound(180)}>🥁 Удар</button><button disabled={soundPlaying} onClick={()=>playSound(760)}>🔔 Сигнал</button></div>:null}
          {consentPanel ? <div className="consent-panel voice-inline-panel"><strong>Согласие на запись</strong><span>{Object.values(consents).filter((value)=>value==="accepted").length} из {Object.keys(consents).length} подтвердили</span><div>{Object.entries(consents).map(([identity,value])=><small key={identity} className={`consent-${value}`}>{identity.slice(0,8)} · {value==="accepted"?"согласен":value==="declined"?"отказался":"ожидаем"}</small>)}</div></div>:null}
        </section>
      </main>

      <nav className="voice-bottom-controls" aria-label="Управление голосовым каналом">
        <button className={muted?"is-muted":""} onClick={toggleMute} aria-label={muted?"Включить микрофон":"Выключить микрофон"}>{muted?<MicOff size={20}/>:<Mic size={20}/>}<span>Микрофон</span></button>
        <button className={deafened?"is-muted":""} onClick={toggleDeafen} aria-label={deafened?"Включить звук":"Выключить звук"}><Headphones size={20}/><span>Звук</span></button>
        <button className={camera?"is-active":""} onClick={toggleCamera} aria-label={camera?"Выключить камеру":"Включить камеру"}>{camera?<VideoOff size={20}/>:<Video size={20}/>}<span>Камера</span></button>
        <button className={sharing?"is-active":""} onClick={toggleScreen} disabled={!screenSupported} aria-label={sharing?"Остановить демонстрацию экрана":"Демонстрация экрана"}><MonitorUp size={20}/><span>Экран</span></button>
        <button className="voice-leave" onClick={leave} aria-label="Отключиться"><PhoneOff size={20}/><span>Выйти</span></button>
      </nav>

      {incomingConsent ? <div className="consent-request"><ShieldCheck size={20}/><div><strong>{incomingConsent.requester} запрашивает запись</strong><span>Подтвердите согласие на запись и транскрипцию комнаты.</span></div><button onClick={()=>respondToConsent(true)}>Согласен</button><button onClick={()=>respondToConsent(false)}>Отказаться</button></div>:null}
    </div>
  );
}
