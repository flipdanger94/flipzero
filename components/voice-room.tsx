"use client";

import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  LoaderCircle,
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
export type VoicePresence = { id: string; name: string; muted: boolean; camera: boolean; sharing: boolean; speaking: boolean };
const qualityLabels = {
  [ConnectionQuality.Excellent]: "Отличная",
  [ConnectionQuality.Good]: "Хорошая",
  [ConnectionQuality.Poor]: "Слабая",
  [ConnectionQuality.Lost]: "Нет связи",
  [ConnectionQuality.Unknown]: "Проверка",
};

type AudioPrefs = {
  inputId?: string;
  outputId?: string;
  inputVolume?: number;
  outputVolume?: number;
  inputProfile?: "standard" | "noise" | "raw";
};

function readAudioPrefs(): AudioPrefs {
  try { return JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}") as AudioPrefs; }
  catch { return {}; }
}

function captureOptions(prefs: AudioPrefs, inputId?: string) {
  return {
    ...(inputId ? { deviceId: inputId } : {}),
    echoCancellation: prefs.inputProfile !== "raw",
    noiseSuppression: prefs.inputProfile === "noise",
    autoGainControl: prefs.inputProfile !== "raw",
  };
}

function microphoneErrorMessage(cause: unknown) {
  const name = cause instanceof DOMException ? cause.name : cause instanceof Error ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Доступ к микрофону запрещён. Разрешите микрофон для FlipZero в браузере или Windows и нажмите «Включить».";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Микрофон не найден. Подключите устройство и попробуйте ещё раз.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Микрофон занят другим приложением или недоступен системе. Закройте программу, использующую микрофон, и попробуйте снова.";
  return "Не удалось открыть микрофон. Проверьте разрешения и выбранное устройство.";
}

export function VoiceRoom({
  channelId,
  channelName,
  autoJoin = false,
  onPresenceChange,
}: {
  channelId: string;
  channelName: string;
  autoJoin?: boolean;
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
  const joinRef = useRef<() => Promise<void>>(async () => {});
  const outputVolumeRef = useRef(1);

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

  async function refreshDeviceLists() {
    if (!navigator.mediaDevices?.enumerateDevices) return { microphones: [] as MediaDeviceInfo[], speakers: [] as MediaDeviceInfo[] };
    const all = await navigator.mediaDevices.enumerateDevices();
    const microphones = all.filter((item) => item.kind === "audioinput");
    const speakers = all.filter((item) => item.kind === "audiooutput");
    setDevices(microphones);
    setOutputDevices(speakers);
    return { microphones, speakers };
  }

  async function requestMicrophone(preferredId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("MEDIA_DEVICES_UNAVAILABLE");
    const prefs = readAudioPrefs();
    let stream: MediaStream | null = null;
    let selectedId = preferredId;
    try {
      if (preferredId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { ...captureOptions(prefs), deviceId: { exact: preferredId } } });
        } catch (cause) {
          const name = cause instanceof DOMException ? cause.name : cause instanceof Error ? cause.name : "";
          if (name !== "OverconstrainedError" && name !== "NotFoundError" && name !== "DevicesNotFoundError") throw cause;
          selectedId = undefined;
        }
      }
      if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: captureOptions(prefs) });
      const actualId = stream.getAudioTracks()[0]?.getSettings().deviceId;
      if (actualId) selectedId = actualId;
      return selectedId;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => {
      void refreshDeviceLists().then(({ microphones, speakers }) => {
        const activeInput = roomRef.current?.getActiveDevice("audioinput");
        const activeOutput = roomRef.current?.getActiveDevice("audiooutput");
        if (activeInput && microphones.some((item) => item.deviceId === activeInput)) setDeviceId(activeInput);
        else if (microphones[0]) setDeviceId(microphones[0].deviceId);
        if (activeOutput && speakers.some((item) => item.deviceId === activeOutput)) setOutputDeviceId(activeOutput);
        else if (speakers[0]) setOutputDeviceId(speakers[0].deviceId);
      }).catch(() => {});
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, []);

  async function join() {
    if (status !== "idle") return;
    const attempt = ++joinAttemptRef.current;
    setStatus("connecting");
    setError("");
    let room: Room | null = null;
    let connectTimeout: number | undefined;
    try {
      const presenceResponse = await fetch(`/api/v1/channels/${channelId}/voice`, { method: "POST" });
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
      room = new Room({ adaptiveStream: true, dynacast: true });
      const connectedRoom = room;
      roomRef.current = room;
      const refresh = () => {
        const participants = [connectedRoom.localParticipant, ...connectedRoom.remoteParticipants.values()];
        setParticipantCount(participants.length);
        onPresenceChange?.(participants.map((participant) => ({
          id: participant.identity,
          name: participant.name || participant.identity,
          muted: !participant.isMicrophoneEnabled,
          camera: participant.isCameraEnabled,
          sharing: participant.isScreenShareEnabled,
          speaking: participant.isSpeaking,
        })));
      };
      room.on(RoomEvent.ParticipantConnected, refresh);
      room.on(RoomEvent.ParticipantDisconnected, refresh);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeaker(speakers[0]?.name || speakers[0]?.identity || "");
        refresh();
      });
      room.on(RoomEvent.TrackMuted, refresh);
      room.on(RoomEvent.TrackUnmuted, refresh);
      room.on(RoomEvent.TrackPublished, refresh);
      room.on(RoomEvent.TrackUnpublished, refresh);
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
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          if (element instanceof HTMLAudioElement) { element.muted = deafenedRef.current; element.volume = outputVolumeRef.current; }
          audioRef.current?.appendChild(element);
        }
        if (track.kind === Track.Kind.Video) {
          const element = track.attach();
          element.dataset.source = track.source;
          remoteVideoRef.current?.appendChild(element);
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
        void fetch(`/api/v1/channels/${channelId}/voice`, { method: "DELETE" });
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!connectedRoom.canPlaybackAudio));
      await Promise.race([
        room.connect(data.url, data.token, { websocketTimeout: 10000, peerConnectionTimeout: 10000, maxRetries: 1 }),
        new Promise<never>((_, reject) => {
          connectTimeout = window.setTimeout(() => reject(new Error("VOICE_CONNECTION_TIMEOUT")), 20000);
        }),
      ]);
      window.clearTimeout(connectTimeout);
      if (attempt !== joinAttemptRef.current) { void room.disconnect(); return; }
      const audioPrefs = readAudioPrefs();
      outputVolumeRef.current = Math.max(0, Math.min(1, Number(audioPrefs.outputVolume ?? 100) / 100));
      let validatedInput: string | undefined;
      try {
        validatedInput = await requestMicrophone(audioPrefs.inputId);
      } catch (cause) {
        setMuted(true);
        setError(microphoneErrorMessage(cause));
      }
      const { microphones, speakers } = await refreshDeviceLists().catch(() => ({ microphones: [] as MediaDeviceInfo[], speakers: [] as MediaDeviceInfo[] }));
      if (attempt !== joinAttemptRef.current) { void room.disconnect(); return; }
      if (!validatedInput && audioPrefs.inputId && !microphones.some((item) => item.deviceId === audioPrefs.inputId)) {
        try {
          const current = readAudioPrefs();
          localStorage.setItem("flipzero:audio-devices:v1", JSON.stringify({ ...current, inputId: undefined }));
        } catch {}
      }
      const preferredInput = validatedInput && microphones.some((item) => item.deviceId === validatedInput)
        ? validatedInput
        : microphones.some((item) => item.deviceId === audioPrefs.inputId)
          ? audioPrefs.inputId
          : microphones[0]?.deviceId;
      const preferredOutput = speakers.some((item) => item.deviceId === audioPrefs.outputId) ? audioPrefs.outputId : speakers[0]?.deviceId;
      if (preferredInput) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true, captureOptions(audioPrefs, preferredInput));
          setMuted(false);
          setError("");
        } catch (firstCause) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true, captureOptions(audioPrefs));
            setMuted(false);
            setError("");
          } catch {
            setMuted(true);
            setError(microphoneErrorMessage(firstCause));
          }
        }
      }
      try { await room.startAudio(); } catch { setAudioBlocked(true); }
      setAudioBlocked(!room.canPlaybackAudio);
      if (preferredInput) await room.switchActiveDevice("audioinput", preferredInput).catch(() => {});
      if (preferredOutput) await room.switchActiveDevice("audiooutput", preferredOutput).catch(() => {});
      setDeviceId(room.getActiveDevice("audioinput") ?? preferredInput ?? "");
      setOutputDeviceId(room.getActiveDevice("audiooutput") ?? preferredOutput ?? "");
      refresh();
      setStatus("connected");
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
        const nextId = detail.deviceId;
        void requestMicrophone(nextId)
          .then(() => room.switchActiveDevice("audioinput", nextId))
          .then(() => room.localParticipant.isMicrophoneEnabled ? undefined : room.localParticipant.setMicrophoneEnabled(true, captureOptions(readAudioPrefs(), nextId)))
          .then(() => { setDeviceId(nextId); setMuted(false); setError(""); })
          .catch((cause) => setError(microphoneErrorMessage(cause)));
      }
      if (detail.type === "output-device" && typeof detail.deviceId === "string") {
        void room.switchActiveDevice("audiooutput", detail.deviceId).then(() => setOutputDeviceId(detail.deviceId as string)).catch(() => setError("Не удалось переключить устройство вывода."));
      }
      if (detail.type === "output-volume") {
        const volume = Math.max(0, Math.min(1, Number(detail.value ?? 100) / 100));
        outputVolumeRef.current = volume;
        audioRef.current?.querySelectorAll("audio").forEach((audio) => { audio.volume = volume; });
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
    const room = roomRef.current;
    if (!room) return;
    try {
      await requestMicrophone(next);
      await room.switchActiveDevice("audioinput", next);
      if (!room.localParticipant.isMicrophoneEnabled) await room.localParticipant.setMicrophoneEnabled(true, captureOptions(readAudioPrefs(), next));
      setDeviceId(next);
      setMuted(false);
      saveDevicePreference("inputId", next);
      setError("");
    } catch (cause) { setError(microphoneErrorMessage(cause)); }
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
      if (!next) {
        const prefs = readAudioPrefs();
        const selected = await requestMicrophone(prefs.inputId);
        await room.localParticipant.setMicrophoneEnabled(true, captureOptions(prefs, selected));
        if (selected) { setDeviceId(selected); saveDevicePreference("inputId", selected); }
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
      }
      setMuted(next);
      void fetch(`/api/v1/channels/${channelId}/voice`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ selfMuted: next }) });
      setError("");
    } catch (cause) { setMuted(true); setError(microphoneErrorMessage(cause)); }
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
    setMuted(false);
    setAudioBlocked(false);
    setDeafened(false);
    deafenedRef.current = false;
    setActiveSpeaker("");
    setQuality(ConnectionQuality.Unknown);
    setSettings(false);
    setSoundboard(false);
    setConsentPanel(false);
    setIncomingConsent(null);
    setConsents({});
    onPresenceChange?.([]);
  }

  const showingVideo = camera || sharing || remoteVideo;
  const connected = status === "connected" || status === "reconnecting";
  return (
    <div className={`voice-room ${showingVideo ? "has-video" : ""}`}>
      <div ref={audioRef} className="remote-audio" />
      <div className={`video-grid ${camera && !sharing && !remoteVideo ? "camera-only" : ""}`} hidden={!showingVideo}>
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
        {status === "idle" && voiceChecked ? <span className="voice-server-ready" role="status">Сервер голосовой связи доступен</span> : null}
        {connected && audioBlocked ? <button className="voice-enable-audio" onClick={enableAudio}><Headphones size={18} /> Включить звук</button> : null}
        {error ? <div className="voice-error">{error}</div> : null}
        {status === "idle" ? (
          voiceAvailable === false ? <div className="voice-unavailable" role="status">{voiceMessage}<button type="button" onClick={() => { setVoiceAvailable(null); setVoiceCheckNonce((value) => value + 1); }}>Проверить ещё раз</button></div> :
          <button className="voice-join" onClick={join} disabled={voiceAvailable === null}>
            {voiceAvailable === null ? <><LoaderCircle className="spin" size={19} /> Подключаем к комнате…</> : <><Headphones size={19} /> Переподключиться</>}
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
              <button className={deafened ? "is-muted" : ""} onClick={toggleDeafen} aria-pressed={deafened}>
                <Headphones size={20} />
                <span>{deafened ? "Включить звук" : "Выключить звук"}</span>
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
                disabled={!screenSupported}
                title={!screenSupported ? "Демонстрация экрана доступна на компьютере" : undefined}
              >
                <MonitorUp size={20} />
                <span>{sharing ? "Остановить" : screenSupported ? "Экран" : "Экран недоступен"}</span>
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
            {settings ? <div className="voice-device-settings">
              <label className="device-picker"><span>Микрофон</span><select value={deviceId} onChange={(event) => void chooseDevice(event.target.value)} disabled={!devices.length}>
                {!devices.length ? <option value="">Микрофон недоступен</option> : devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Микрофон ${index + 1}`}</option>)}
              </select></label>
              <label className="device-picker"><span>Динамики / наушники</span><select value={outputDeviceId} onChange={(event) => void chooseOutput(event.target.value)} disabled={!outputDevices.length}>
                {!outputDevices.length ? <option value="">Выбор устройства недоступен в этом браузере</option> : outputDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Устройство ${index + 1}`}</option>)}
              </select></label>
            </div> : null}
            {soundboard ? (
              <div className="soundboard">
                <button disabled={soundPlaying} onClick={() => playSound(330)}>✨ Магия</button>
                <button disabled={soundPlaying} onClick={() => playSound(520)}>🎉 Победа</button>
                <button disabled={soundPlaying} onClick={() => playSound(180)}>🥁 Удар</button>
                <button disabled={soundPlaying} onClick={() => playSound(760)}>🔔 Сигнал</button>
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
