"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  Headphones,
  LoaderCircle,
  Maximize2,
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
  Volume2,
  VolumeX,
} from "lucide-react";
import { ConnectionQuality, Room, RoomEvent, Track } from "livekit-client";
import { MediaImage } from "./media-image";
import { normalizeVoicePresence, type VoicePresence } from "@/lib/voice-presence";
import { voiceGridLayout } from "@/lib/voice-layout";

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
  presence,
  initialStreamId = "",
  spaceName = "",
  onPresenceChange,
  tokenUrl,
  stateUrl,
  tokenRequestBody,
  sessionKind = "channel",
  sessionTargetId,
}: {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
  presence?: VoicePresence[];
  initialStreamId?: string;
  spaceName?: string;
  onPresenceChange?: (participants: VoicePresence[]) => void;
  tokenUrl?: string;
  stateUrl?: string | null;
  tokenRequestBody?: Record<string, unknown>;
  sessionKind?: "channel" | "clan";
  sessionTargetId?: string;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [localPresence, setLocalPresence] = useState<VoicePresence[]>([]);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceChecked, setVoiceChecked] = useState(false);
  const [voiceCheckNonce, setVoiceCheckNonce] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [camera, setCamera] = useState(false);
  const [cameraPreviewOpen, setCameraPreviewOpen] = useState(false);
  const [cameraPreviewError, setCameraPreviewError] = useState("");
  const [cameraPreviewBusy, setCameraPreviewBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [screenQuality, setScreenQuality] = useState<"720"|"1080">("1080");
  const [screenFps, setScreenFps] = useState<15|30|60>(30);
  const [screenAudio, setScreenAudio] = useState(true);
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
  const resolvedTokenUrl = tokenUrl ?? `/api/v1/channels/${channelId}/voice-token`;
  const resolvedStateUrl = stateUrl === undefined ? `/api/v1/channels/${channelId}/voice` : stateUrl;
  const resolvedLeaveUrl = stateUrl === undefined ? `/api/v1/channels/${channelId}/voice?leave=1` : stateUrl ? `${stateUrl}?leave=1` : null;
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
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraPreviewStreamRef = useRef<MediaStream | null>(null);
  const consentRequestRef = useRef("");
  const deafenedRef = useRef(false);
  const joinAttemptRef = useRef(0);
  const soundPlayingRef = useRef(false);
  const speakingRef = useRef(false);
  const speakingTimerRef = useRef<number | null>(null);
  const selectedStreamRef = useRef(initialStreamId);
  const intentionalLeaveRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const joinRef = useRef<() => Promise<void>>(async () => {});
  const outputVolumeRef = useRef(1);
  const voiceRootRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      intentionalLeaveRef.current = true;
      joinAttemptRef.current++;
      if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStreamRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    },
    [channelId],
  );
  useEffect(() => { selectedStreamRef.current = selectedStreamId; }, [selectedStreamId]);
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
  function clearMedia(container: HTMLElement | null) {
    container?.replaceChildren();
  }
  function mediaTarget(participantId: string, source: "camera"|"screen") {
    return voiceRootRef.current?.querySelector<HTMLElement>(`[data-voice-media-id="${CSS.escape(participantId)}"][data-voice-media-source="${source}"]`) ?? null;
  }
  function attachParticipantVideo(participantId: string, source: "camera"|"screen", track: Track, attempt = 0) {
    const target = mediaTarget(participantId, source);
    if (!target) {
      if (attempt < 8) window.setTimeout(() => attachParticipantVideo(participantId, source, track, attempt + 1), 80 + attempt * 30);
      return;
    }
    clearMedia(target);
    const element = track.attach();
    element.dataset.participantId = participantId;
    element.dataset.voiceMediaSource = source;
    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
      if (participantId === roomRef.current?.localParticipant.identity) element.muted = true;
    }
    target.appendChild(element);
  }
  function clearParticipantVideo(participantId: string, source: "camera"|"screen") {
    clearMedia(mediaTarget(participantId, source));
  }
  function attachLocal(source: Track.Source) {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublication(source)?.track;
    if (!room || !track) return;
    attachParticipantVideo(room.localParticipant.identity, source === Track.Source.ScreenShare ? "screen" : "camera", track);
  }
  function emitVoiceSession(connected: boolean, nextQuality = quality) {
    window.dispatchEvent(new CustomEvent("flipzero:voice-session", { detail: {
      connected, channelId, channelName, spaceName, quality: qualityLabels[nextQuality] ?? "Проверка", sessionKind, sessionTargetId,
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
    intentionalLeaveRef.current = false;
    const attempt = ++joinAttemptRef.current;
    setStatus("connecting");
    setError("");
    let room: Room | null = null;
    let connectTimeout: number | undefined;
    try {
      if (resolvedStateUrl) {
        const presenceResponse = await fetch(resolvedStateUrl, { method: "POST" });
        const presenceData = await presenceResponse.json().catch(() => null);
        if (!presenceResponse.ok) { setError(presenceData?.message ?? "Нет доступа к голосовому каналу."); setStatus("idle"); return; }
      }
      const response = await fetch(resolvedTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tokenRequestBody ?? { breakout }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (attempt !== joinAttemptRef.current) return;
      if (!response.ok) { setError(data.message ?? "Не удалось подключиться."); setStatus("idle"); return; }
      room = new Room({ adaptiveStream: true, dynacast: true });
      const connectedRoom = room;
      roomRef.current = room;
      const refresh = () => {
        const participants = [connectedRoom.localParticipant, ...connectedRoom.remoteParticipants.values()];
        setParticipantCount(participants.length);
        const nextPresence = normalizeVoicePresence(participants.map((participant) => {
          let metadata: Record<string, unknown> = {};
          try { metadata = participant.metadata ? JSON.parse(participant.metadata) as Record<string, unknown> : {}; } catch { metadata = {}; }
          return {
            id: participant.identity,
            name: participant.name || participant.identity,
            avatarUrl: typeof metadata.avatarUrl === "string" ? metadata.avatarUrl : null,
            clanTag: typeof metadata.clanTag === "string" ? metadata.clanTag : null,
            muted: !participant.isMicrophoneEnabled,
            deafened: participant.attributes?.deafened === "true" || participant.attributes?.selfDeafened === "true",
            camera: participant.isCameraEnabled,
            sharing: participant.isScreenShareEnabled,
            streaming: participant.isScreenShareEnabled,
            speaking: participant.isSpeaking,
          };
        }));
        setLocalPresence(nextPresence);
        onPresenceChange?.(nextPresence);
      };
      room.on(RoomEvent.ParticipantConnected, refresh);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ParticipantMetadataChanged, refresh);
      room.on(RoomEvent.ParticipantAttributesChanged, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeaker(speakers[0]?.name || speakers[0]?.identity || "");
        const localSpeaking = speakers.some((participant) => participant.isLocal);
        if (localSpeaking !== speakingRef.current) {
          speakingRef.current = localSpeaking;
          if (speakingTimerRef.current) window.clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = window.setTimeout(() => {
            if (resolvedStateUrl) void fetch(resolvedStateUrl, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ speaking: speakingRef.current }),
            }).catch(() => undefined);
          }, 1600);
        }
        refresh();
      });
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.MediaDevicesError, (mediaError) => {
        const message=String(mediaError?.message??mediaError??"");
        if(/permission|denied|notallowed/i.test(message)) setError("Нет разрешения на микрофон или камеру. Разрешите доступ в настройках браузера.");
        else if(/notfound|device/i.test(message)) setError("Устройство не найдено или отключено.");
        else setError("Не удалось использовать аудио- или видеоустройство.");
      });
      room.on(RoomEvent.TrackSubscriptionFailed, () => setError("Не удалось загрузить медиапоток. Попробуйте открыть его ещё раз."));
      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
          publication.setSubscribed(participant.identity === selectedStreamRef.current);
        } else {
          publication.setSubscribed(true);
        }
        refresh();
      });
      room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        if ((publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) && participant.identity === selectedStreamRef.current) {
          selectedStreamRef.current = "";
          setSelectedStreamId("");
          setFocusMode(false);
        }
        refresh();
      });
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
      room.on(RoomEvent.Reconnected, () => { reconnectAttemptsRef.current = 0; setStatus("connected"); });
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        const isScreen = publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio;
        if (isScreen && participant.identity !== selectedStreamRef.current) {
          publication.setSubscribed(false);
          return;
        }
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.dataset.participantId = participant.identity;
          if (element instanceof HTMLAudioElement) { element.muted = deafenedRef.current; element.volume = outputVolumeRef.current; }
          audioRef.current?.appendChild(element);
        }
        if (track.kind === Track.Kind.Video) {
          attachParticipantVideo(participant.identity, track.source === Track.Source.ScreenShare ? "screen" : "camera", track);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach().forEach((element) => element.remove());
        if (track.kind === Track.Kind.Video) {
          clearParticipantVideo(participant.identity, publication.source === Track.Source.ScreenShare ? "screen" : "camera");
        }
      });
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.source === Track.Source.Camera) {
          setCamera(true);
          attachLocal(Track.Source.Camera);
        }
        if (publication.source === Track.Source.ScreenShare) {
          setSharing(true);
          attachLocal(Track.Source.ScreenShare);
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.Camera) {
          setCamera(false);
          clearParticipantVideo(connectedRoom.localParticipant.identity, "camera");
        }
        if (publication.source === Track.Source.ScreenShare) {
          setSharing(false);
          clearParticipantVideo(connectedRoom.localParticipant.identity, "screen");
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== connectedRoom) return;
        roomRef.current = null;
        setParticipantCount(0);
        setCamera(false);
        setSharing(false);
        setActiveSpeaker("");
        setLocalPresence([]);
        onPresenceChange?.([]);
        if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "DELETE" }).catch(() => undefined);
        if (intentionalLeaveRef.current) {
          setStatus("idle");
          emitVoiceSession(false);
          playVoiceCue("leave");
          return;
        }
        const retry = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = retry;
        if (retry > 3) {
          setStatus("idle");
          setError("Соединение потеряно. Нажмите «Подключиться», чтобы попробовать снова.");
          emitVoiceSession(false);
          return;
        }
        setStatus("reconnecting");
        setError(`Переподключение… Попытка ${retry} из 3`);
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          setStatus("idle");
          window.setTimeout(() => void joinRef.current(), 0);
        }, Math.min(1500 * retry, 4500));
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!connectedRoom.canPlaybackAudio));
      await Promise.race([
        room.connect(data.url, data.token, { websocketTimeout: 10000, peerConnectionTimeout: 10000, maxRetries: 1, autoSubscribe: false }),
        new Promise<never>((_, reject) => {
          connectTimeout = window.setTimeout(() => reject(new Error("VOICE_CONNECTION_TIMEOUT")), 20000);
        }),
      ]);
      window.clearTimeout(connectTimeout);
      if (attempt !== joinAttemptRef.current) { void room.disconnect(); return; }
      connectedRoom.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          const screen = publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio;
          publication.setSubscribed(!screen || participant.identity === selectedStreamRef.current);
        });
      });
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
      reconnectAttemptsRef.current = 0;
      setStatus("connected");
      emitVoiceSession(true);
      playVoiceCue("join");
    } catch (cause) {
      if (room) void room.disconnect();
      if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "DELETE" });
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
    window.dispatchEvent(new CustomEvent("flipzero:voice-state",{detail:{deafened:next}}));
    if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selfDeafened: next }) });
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
      window.dispatchEvent(new CustomEvent("flipzero:voice-state",{detail:{muted:next}}));
      if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selfMuted: next }) });
      setError("");
    } catch { setError("Не удалось включить микрофон. Разрешите доступ в настройках браузера."); }
  }
  function closeCameraPreview() {
    cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraPreviewStreamRef.current = null;
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setCameraPreviewOpen(false);
    setCameraPreviewBusy(false);
    setCameraPreviewError("");
  }
  async function openCameraPreview() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Камера недоступна в этом браузере.");
      return;
    }
    setCameraPreviewOpen(true);
    setCameraPreviewBusy(true);
    setCameraPreviewError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraPreviewStreamRef.current = stream;
      requestAnimationFrame(() => {
        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = stream;
          void cameraPreviewRef.current.play().catch(() => undefined);
        }
      });
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setCameraPreviewError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Нет разрешения на камеру. Разрешите доступ в настройках браузера."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Камера не найдена или выбранное устройство недоступно."
            : name === "NotReadableError"
              ? "Камера занята другим приложением. Закройте его и попробуйте снова."
              : "Не удалось открыть камеру.",
      );
    } finally {
      setCameraPreviewBusy(false);
    }
  }
  async function confirmCamera() {
    const room = roomRef.current;
    if (!room) return;
    setCameraPreviewBusy(true);
    try {
      closeCameraPreview();
      await room.localParticipant.setCameraEnabled(true);
      setCamera(true);
      attachLocal(Track.Source.Camera);
      setError("");
    } catch {
      setCamera(false);
      setError("Не удалось включить камеру. Проверьте разрешение браузера и доступ к устройству.");
    } finally {
      setCameraPreviewBusy(false);
    }
  }
  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    if (!camera) {
      await openCameraPreview();
      return;
    }
    try {
      await room.localParticipant.setCameraEnabled(false);
      setCamera(false);
      if (room) clearParticipantVideo(room.localParticipant.identity, "camera");
      setError("");
    } catch {
      setError("Не удалось выключить камеру.");
    }
  }
  async function toggleScreen() {
    const room = roomRef.current;
    if (!room) return;
    if (!screenSupported) { setError("Демонстрация экрана недоступна в этом браузере. Откройте FlipZero на компьютере."); return; }
    const next = !sharing;
    try {
      if(next){
        const safari=/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const resolution=screenQuality==="720"
          ? {width:1280,height:720,frameRate:screenFps}
          : {width:1920,height:1080,frameRate:screenFps};
        await room.localParticipant.setScreenShareEnabled(true,{
          audio:screenAudio,
          systemAudio:screenAudio?"include":"exclude",
          contentHint:"detail",
          surfaceSwitching:"include",
          ...(safari?{}:{resolution}),
        },{simulcast:true});
      }else{
        await room.localParticipant.setScreenShareEnabled(false);
      }
      setSharing(next);
      if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ streaming: next }) });
      if (next) attachLocal(Track.Source.ScreenShare);
      else clearParticipantVideo(room.localParticipant.identity, "screen");
      setError("");
    } catch {
      setError("Демонстрация экрана отменена или недоступна.");
    }
  }
  function leave() {
    intentionalLeaveRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    joinAttemptRef.current++;
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    if (resolvedStateUrl) void fetch(resolvedStateUrl, { method: "DELETE" });
    emitVoiceSession(false);
    playVoiceCue("leave");
    clearMedia(audioRef.current);
    voiceRootRef.current?.querySelectorAll<HTMLElement>("[data-voice-media-id]").forEach((element) => clearMedia(element));
    setStatus("idle");
    setParticipantCount(0);
    setCamera(false);
    setSharing(false);
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
    setLocalPresence([]);
    onPresenceChange?.([]);
  }

  const normalizedPresence = normalizeVoicePresence(presence?.length ? presence : localPresence);
  const compactMode=typeof document!=="undefined"&&document.documentElement.dataset.compact==="on";
  const gridLayout=voiceGridLayout(normalizedPresence.length,compactMode);
  const visibleParticipants = normalizedPresence.slice(0, gridLayout.visible);
  const hiddenParticipantCount = Math.max(0, normalizedPresence.length - visibleParticipants.length);
  const connected = status === "connected" || status === "reconnecting";

  function focusStream(participantId: string) {
    selectedStreamRef.current = participantId;
    setSelectedStreamId(participantId);
    setFocusMode(true);
    const participant = roomRef.current?.remoteParticipants.get(participantId);
    participant?.trackPublications.forEach((publication) => {
      if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
        publication.setSubscribed(true);
        if (publication.track?.kind === Track.Kind.Video) attachParticipantVideo(participantId, "screen", publication.track);
      }
    });
    window.setTimeout(() => {
      voiceRootRef.current?.querySelector<HTMLElement>(`[data-participant-tile-id="${CSS.escape(participantId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }
  function clearFocus() {
    const previous = selectedStreamRef.current;
    selectedStreamRef.current = "";
    setFocusMode(false);
    setSelectedStreamId("");
    roomRef.current?.remoteParticipants.get(previous)?.trackPublications.forEach((publication) => {
      if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) publication.setSubscribed(false);
    });
    if (previous) clearParticipantVideo(previous, "screen");
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
    if (!connected) return;
    const heartbeat = () => {
      if (document.visibilityState !== "visible") return;
      if (resolvedStateUrl) void fetch(resolvedStateUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heartbeat: true }),
        keepalive: true,
      }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 45_000);
    const pagehide = () => {
      const payload = new Blob([JSON.stringify({ leave: true })], { type: "application/json" });
      if (resolvedLeaveUrl) navigator.sendBeacon?.(resolvedLeaveUrl, payload);
    };
    window.addEventListener("pagehide", pagehide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [connected, channelId, resolvedLeaveUrl, resolvedStateUrl]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']") || event.repeat) return;
      if (event.key.toLowerCase() === "m") { event.preventDefault(); void toggleMute(); }
      if (event.key.toLowerCase() === "d") { event.preventDefault(); void toggleDeafen(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  useEffect(() => {
    if (!initialStreamId || !connected) return;
    const timer = window.setTimeout(() => focusStream(initialStreamId), 0);
    return () => window.clearTimeout(timer);
  }, [initialStreamId, connected]);
  async function toggleFullscreen() {
    const target = selectedStreamId
      ? voiceRootRef.current?.querySelector<HTMLElement>(`[data-participant-tile-id="${CSS.escape(selectedStreamId)}"]`)
      : voiceRootRef.current;
    if (!target) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    } catch { setError("Полноэкранный режим недоступен в этом браузере."); }
  }
  async function openPictureInPicture() {
    const selector = `video[data-participant-id="${selectedStreamId}"][data-voice-media-source="screen"]`;
    const video = voiceRootRef.current?.querySelector<HTMLVideoElement>(`.voice-tile[data-participant-tile-id="${CSS.escape(selectedStreamId)}"] ${selector}`);
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
    <div ref={voiceRootRef} className={`voice-room voice-room-connected ${focusMode ? "is-focus" : ""} ${selectedStreamId && !focusMode ? "has-mini-stream" : ""}`}>
      <div ref={audioRef} className="remote-audio"/>
      <main className="voice-stage-layout">
        <section className="voice-stage-main" aria-label="Сцена голосового канала" onTouchStart={(event)=>{swipeStartRef.current=event.touches[0]?.clientY??null}} onTouchEnd={(event)=>{const start=swipeStartRef.current;const end=event.changedTouches[0]?.clientY;if(focusMode&&start!==null&&typeof end==="number"&&end-start>80)clearFocus();swipeStartRef.current=null}}>
          {normalizedPresence.length === 0 ? <div className="voice-stage-empty voice-stage-empty-visible" role="status"><Users size={28}/><strong>В канале пока никого нет</strong><span>Участники появятся здесь после подключения.</span></div> : null}
          <div className="voice-tile-grid" role="list" aria-label="Участники" data-participant-count={normalizedPresence.length} style={{"--voice-grid-columns":gridLayout.columns,"--voice-grid-rows":gridLayout.rows} as CSSProperties}>
            {visibleParticipants.map((participant)=><article key={participant.id} role="listitem" data-participant-tile-id={participant.id} className={`voice-tile ${participant.speaking ? "speaking" : ""} ${participant.streaming || participant.sharing ? "is-streaming" : ""} ${participant.camera ? "has-camera" : ""} ${selectedStreamId===participant.id ? "is-stream-selected" : ""} ${focusMode&&selectedStreamId===participant.id ? "is-media-focus" : ""}`} onDoubleClick={participant.streaming || participant.sharing ? ()=>{if(selectedStreamId!==participant.id)focusStream(participant.id);window.setTimeout(()=>void toggleFullscreen(),0)} : undefined}>
              <div className="voice-tile-media" aria-hidden="true">
                <div className="voice-tile-camera" data-voice-media-id={participant.id} data-voice-media-source="camera"/>
                <div className="voice-tile-screen" data-voice-media-id={participant.id} data-voice-media-source="screen"/>
              </div>
              <div className="voice-tile-avatar">{participant.avatarUrl?<MediaImage src={participant.avatarUrl}/>:participant.name.slice(0,2).toLocaleUpperCase("ru")}</div>
              <footer className="voice-tile-footer"><strong title={participant.name}>{participant.name}{participant.clanTag ? <em className="voice-clan-tag"> [{participant.clanTag}]</em> : null}</strong><span>{participant.streaming || participant.sharing ? <b className="voice-live-badge">LIVE</b> : null}{participant.muted?<MicOff size={14}/>:null}{participant.deafened?<Headphones size={14}/>:null}{participant.camera?<Video size={14}/>:null}</span></footer>
              {participant.streaming || participant.sharing ? selectedStreamId===participant.id ? <div className="voice-tile-stream-actions" aria-label={`Управление стримом ${participant.name}`}>
                <label aria-label="Громкость стрима"><Volume2 size={14}/><input type="range" min="0" max="100" value={streamVolume} onChange={(event)=>setStreamVolume(Number(event.target.value))}/></label>
                <button type="button" onClick={()=>setStreamMuted((value)=>!value)} aria-label={streamMuted ? "Включить звук стрима" : "Выключить звук стрима"}>{streamMuted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
                <button type="button" onClick={()=>void openPictureInPicture()} aria-label="Картинка в картинке"><MonitorUp size={16}/></button>
                <button type="button" onClick={()=>void toggleFullscreen()} aria-label="Развернуть стрим на весь экран" title="На весь экран"><Maximize2 size={16}/></button>
                <button type="button" onClick={clearFocus} aria-label={`Закрыть стрим ${participant.name}`}>×</button>
              </div> : <button type="button" className="voice-tile-watch" onClick={()=>focusStream(participant.id)} aria-label={`Смотреть стрим ${participant.name}`}>Смотреть стрим</button> : null}
            </article>)}
            {hiddenParticipantCount ? <article className="voice-tile voice-tile-more" role="listitem"><strong>+{hiddenParticipantCount}</strong><span>ещё участников</span></article>:null}
          </div>
          {activeSpeaker || audioBlocked || error ? <div className="voice-stage-notices">{activeSpeaker ? <div className="active-speaker"><i/>Говорит: <b>{activeSpeaker}</b></div>:null}{audioBlocked ? <button className="voice-enable-audio" onClick={enableAudio}><Headphones size={18}/>Включить звук</button>:null}{error ? <div className="voice-error">{error}</div>:null}</div>:null}

          {settings ? <div className="voice-device-settings voice-inline-panel">
            <label className="device-picker"><span>Микрофон</span><select value={deviceId} onChange={(event)=>void chooseDevice(event.target.value)} disabled={!devices.length}>{!devices.length?<option value="">Микрофон недоступен</option>:devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Микрофон ${index+1}`}</option>)}</select></label>
            <label className="device-picker"><span>Динамики / наушники</span><select value={outputDeviceId} onChange={(event)=>void chooseOutput(event.target.value)} disabled={!outputDevices.length}>{!outputDevices.length?<option value="">Системное устройство</option>:outputDevices.map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Устройство ${index+1}`}</option>)}</select></label>
            <div className="voice-screen-options"><strong>Демонстрация экрана</strong><div><label><span>Качество</span><select value={screenQuality} onChange={(event)=>setScreenQuality(event.target.value as "720"|"1080")} disabled={sharing}><option value="720">720p</option><option value="1080">1080p</option></select></label><label><span>FPS</span><select value={screenFps} onChange={(event)=>setScreenFps(Number(event.target.value) as 15|30|60)} disabled={sharing}><option value="15">15</option><option value="30">30</option><option value="60">60</option></select></label><label className="voice-screen-audio"><input type="checkbox" checked={screenAudio} onChange={(event)=>setScreenAudio(event.target.checked)} disabled={sharing}/><span>Системный звук, если браузер поддерживает</span></label></div></div>
          </div>:null}
          {soundboard ? <div className="soundboard voice-inline-panel"><button disabled={soundPlaying} onClick={()=>playSound(330)}>✨ Магия</button><button disabled={soundPlaying} onClick={()=>playSound(520)}>🎉 Победа</button><button disabled={soundPlaying} onClick={()=>playSound(180)}>🥁 Удар</button><button disabled={soundPlaying} onClick={()=>playSound(760)}>🔔 Сигнал</button></div>:null}
          {consentPanel ? <div className="consent-panel voice-inline-panel"><strong>Согласие на запись</strong><span>{Object.values(consents).filter((value)=>value==="accepted").length} из {Object.keys(consents).length} подтвердили</span><div>{Object.entries(consents).map(([identity,value])=><small key={identity} className={`consent-${value}`}>{identity.slice(0,8)} · {value==="accepted"?"согласен":value==="declined"?"отказался":"ожидаем"}</small>)}</div></div>:null}
        </section>
      </main>

      <nav className="voice-bottom-controls" aria-label="Управление голосовым каналом">
        <button className={muted?"is-muted":""} onClick={toggleMute} aria-label={muted?"Включить микрофон":"Выключить микрофон"} title="Микрофон · M">{muted?<MicOff size={20}/>:<Mic size={20}/>}<span>Микрофон</span></button>
        <button className={deafened?"is-muted":""} onClick={toggleDeafen} aria-label={deafened?"Включить звук":"Выключить звук"} title="Звук · D"><Headphones size={20}/><span>Звук</span></button>
        <button className={camera?"is-active":""} onClick={toggleCamera} aria-label={camera?"Выключить камеру":"Включить камеру"}>{camera?<VideoOff size={20}/>:<Video size={20}/>}<span>Камера</span></button>
        <button className={sharing?"is-active":""} onClick={toggleScreen} disabled={!screenSupported} aria-label={sharing?"Остановить демонстрацию экрана":"Демонстрация экрана"}><MonitorUp size={20}/><span>Экран</span></button>
        <button className={settings?"is-active":""} onClick={()=>setSettings((value)=>!value)} aria-label="Устройства" title="Устройства"><Settings2 size={20}/><span>Устройства</span></button>
        <button className={soundboard?"is-active":""} onClick={()=>setSoundboard((value)=>!value)} aria-label="Soundboard" title="Soundboard"><Music2 size={20}/><span>Soundboard</span></button>
        <button onClick={requestRecordingConsent} aria-label="Запросить согласие на запись" title="Согласие на запись"><ShieldCheck size={20}/><span>Запись</span></button>
        <button className="voice-leave" onClick={leave} aria-label="Отключиться"><PhoneOff size={20}/><span>Выйти</span></button>
      </nav>

      {cameraPreviewOpen ? <div className="voice-camera-preview-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)closeCameraPreview()}}>
        <section className="voice-camera-preview" role="dialog" aria-modal="true" aria-label="Предпросмотр камеры">
          <header><div><small>ПРЕДПРОСМОТР КАМЕРЫ</small><strong>Проверьте кадр перед включением</strong></div><button type="button" onClick={closeCameraPreview} aria-label="Закрыть предпросмотр">×</button></header>
          <div className="voice-camera-preview-video">{cameraPreviewError ? <div className="voice-camera-preview-error">{cameraPreviewError}</div> : <video ref={cameraPreviewRef} autoPlay muted playsInline />}{cameraPreviewBusy ? <LoaderCircle className="spin" size={24}/> : null}</div>
          <footer><button type="button" onClick={closeCameraPreview}>Отмена</button><button type="button" className="primary" onClick={()=>void confirmCamera()} disabled={cameraPreviewBusy||Boolean(cameraPreviewError)}>Включить камеру</button></footer>
        </section>
      </div> : null}
      {incomingConsent ? <div className="consent-request"><ShieldCheck size={20}/><div><strong>{incomingConsent.requester} запрашивает запись</strong><span>Подтвердите согласие на запись и транскрипцию комнаты.</span></div><button onClick={()=>respondToConsent(true)}>Согласен</button><button onClick={()=>respondToConsent(false)}>Отказаться</button></div>:null}
    </div>
  );
}
