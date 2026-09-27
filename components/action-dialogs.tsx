"use client";

import { type FormEvent, useRef, useState } from "react";
import { Dialog } from "./ui/dialog";

type ConfirmProps = { title: string; description: string; confirmLabel: string; confirmationText?: string; destructive?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void };

export function ConfirmDialog({ title, description, confirmLabel, confirmationText, destructive = false, busy = false, onCancel, onConfirm }: ConfirmProps) {
  const [typed, setTyped] = useState("");
  return <Dialog backdropClassName="fz-action-backdrop" className="fz-action-dialog" labelledBy="fz-confirm-title" describedBy="fz-confirm-description" onClose={onCancel}>
      <h2 id="fz-confirm-title">{title}</h2><p id="fz-confirm-description">{description}</p>
      {confirmationText ? <label className="fz-confirm-field">Для подтверждения введите «{confirmationText}»<input autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /></label> : null}
      <footer><button type="button" onClick={onCancel} disabled={busy}>Отмена</button><button type="button" className={destructive ? "destructive" : ""} onClick={onConfirm} disabled={busy || Boolean(confirmationText && typed !== confirmationText)}>{busy ? "Подождите…" : confirmLabel}</button></footer>
    </Dialog>;
}

const reasons = [
  ["spam", "Спам"], ["abuse", "Оскорбления"], ["harassment", "Преследование"],
  ["fraud", "Мошенничество"], ["unwanted_content", "Нежелательный контент"],
  ["impersonation", "Выдаёт себя за другого"], ["other", "Другое"],
] as const;

export function ReportDialog({ targetType, targetId, onClose, onSuccess }: { targetType: "user" | "message"; targetId: string; onClose: () => void; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(formRef.current ?? event.currentTarget);
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason: data.get("reason"), description: data.get("description") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Не удалось отправить жалобу.");
      onSuccess(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отправить жалобу."); }
    finally { setBusy(false); }
  }
  return <Dialog backdropClassName="fz-action-backdrop" className="fz-action-dialog" labelledBy="fz-report-title" onClose={onClose}>
      <h2 id="fz-report-title">Пожаловаться на {targetType === "user" ? "пользователя" : "сообщение"}</h2><p>Укажите причину, чтобы модераторы могли разобраться.</p>
      <form ref={formRef} onSubmit={submit}><label>Причина<select name="reason" required>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Комментарий (необязательно)<textarea name="description" maxLength={2000} rows={4} placeholder="Опишите, что произошло" /></label>
        {error ? <p role="alert" className="fz-action-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose} disabled={busy}>Отмена</button><button disabled={busy}>{busy ? "Отправляем…" : "Отправить жалобу"}</button></footer>
      </form>
    </Dialog>;
}
