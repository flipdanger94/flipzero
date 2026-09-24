"use client";

import {
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Camera, FilePlus2, Image as ImageIcon, Mic, SendHorizontal, Smile, X } from "lucide-react";

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  disabledText = "У вас нет права отправлять сообщения.",
  busy = false,
  limit = 1000,
  hasAttachments = false,
  attachmentPreview,
  accessory,
  onFiles,
  onEmoji,
  onVoice,
  recording = false,
  recordingSeconds = 0,
  textareaRef,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  placeholder: string;
  disabled?: boolean;
  disabledText?: string;
  busy?: boolean;
  limit?: number;
  hasAttachments?: boolean;
  attachmentPreview?: ReactNode;
  accessory?: ReactNode;
  onFiles?: (files: File[]) => void;
  onEmoji?: () => void;
  onVoice?: () => void;
  recording?: boolean;
  recordingSeconds?: number;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mediaRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const effectiveRef = textareaRef ?? localRef;
  const overLimit = value.length > limit;
  const showCounter = value.length >= Math.floor(limit * 0.8);
  const canSend = !disabled && !busy && !overLimit && (Boolean(value.trim()) || hasAttachments);

  useEffect(() => {
    const input = effectiveRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
    input.style.overflowY = input.scrollHeight > 144 ? "auto" : "hidden";
  }, [value, effectiveRef]);

  function pick(ref: RefObject<HTMLInputElement | null>) {
    setAttachOpen(false);
    ref.current?.click();
  }

  function takeFiles(input: HTMLInputElement) {
    const files = [...(input.files ?? [])];
    if (files.length) onFiles?.(files);
    input.value = "";
  }

  return (
    <div className={`chat-composer-shell ${disabled ? "is-disabled" : ""} ${recording ? "is-recording" : ""}`}>
      {attachmentPreview}
      {accessory}
      {disabled ? <div className="chat-composer-locked" role="status">{disabledText}</div> : null}
      {!disabled ? (
        <>
          <div className="chat-composer-row">
            {onFiles ? (
              <div className="chat-attach-wrap">
                <button type="button" className="chat-composer-icon" aria-label="Добавить вложение" title="Добавить вложение" aria-expanded={attachOpen} onClick={() => setAttachOpen((open) => !open)}>
                  <FilePlus2 size={19} />
                </button>
                {attachOpen ? (
                  <div className="chat-attach-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => pick(fileRef)}><FilePlus2 size={17}/>Файл</button>
                    <button type="button" role="menuitem" onClick={() => pick(mediaRef)}><ImageIcon size={17}/>Фото или видео</button>
                    <button type="button" role="menuitem" className="chat-camera-action" onClick={() => pick(cameraRef)}><Camera size={17}/>Камера</button>
                    <button type="button" className="chat-attach-close" aria-label="Закрыть меню вложений" onClick={() => setAttachOpen(false)}><X size={16}/></button>
                  </div>
                ) : null}
                <input ref={fileRef} hidden multiple type="file" accept=".pdf,.txt,.zip,audio/*,image/*,video/*" onChange={(event) => takeFiles(event.currentTarget)} />
                <input ref={mediaRef} hidden multiple type="file" accept="image/*,video/*" onChange={(event) => takeFiles(event.currentTarget)} />
                <input ref={cameraRef} hidden type="file" accept="image/*,video/*" capture="environment" onChange={(event) => takeFiles(event.currentTarget)} />
              </div>
            ) : null}
            <textarea
              ref={effectiveRef}
              rows={1}
              value={value}
              disabled={busy}
              aria-invalid={overLimit}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                if (event.defaultPrevented) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 767;
                  if (!mobile) {
                    event.preventDefault();
                    if (canSend) void onSubmit();
                  }
                }
              }}
            />
            {onEmoji ? <button type="button" className="chat-composer-icon" aria-label="Смайлики" title="Смайлики" onClick={onEmoji}><Smile size={19}/></button> : null}
            {canSend ? (
              <button type="button" className="chat-composer-send" aria-label="Отправить сообщение" title="Отправить сообщение" onClick={() => void onSubmit()} disabled={!canSend}><SendHorizontal size={19}/></button>
            ) : onVoice ? (
              <button type="button" className={`chat-composer-icon ${recording ? "is-recording" : ""}`} aria-label={recording ? "Остановить запись" : "Голосовое сообщение"} title={recording ? "Остановить запись" : "Голосовое сообщение"} onClick={onVoice}>
                <Mic size={19}/>{recording ? <small>{recordingSeconds}</small> : null}
              </button>
            ) : (
              <button type="button" className="chat-composer-send" aria-label="Отправить сообщение" title="Отправить сообщение" disabled><SendHorizontal size={19}/></button>
            )}
          </div>
          {showCounter ? <div className={`chat-composer-counter ${overLimit ? "over-limit" : ""}`}>{value.length} / {limit}</div> : null}
        </>
      ) : null}
    </div>
  );
}
