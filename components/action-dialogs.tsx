"use client";

import { type FormEvent, useRef, useState } from "react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type ConfirmProps = { title: string; description: string; confirmLabel: string; destructive?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void };

export function ConfirmDialog({ title, description, confirmLabel, destructive = false, busy = false, onCancel, onConfirm }: ConfirmProps) {
  const ref = useModalA11y(onCancel);
  return <div className="fz-action-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section ref={ref} tabIndex={-1} className="fz-action-dialog" role="dialog" aria-modal="true" aria-labelledby="fz-confirm-title" aria-describedby="fz-confirm-description">
      <h2 id="fz-confirm-title">{title}</h2><p id="fz-confirm-description">{description}</p>
      <footer><button type="button" onClick={onCancel} disabled={busy}>Отмена</button><button type="button" className={destructive ? "destructive" : ""} onClick={onConfirm} disabled={busy}>{busy ? "Подождите…" : confirmLabel}</button></footer>
    </section>
  </div>;
}

const reasons = [
  ["spam", "Спам"], ["abuse", "Оскорбления"], ["harassment", "Преследование"],
  ["fraud", "Мошенничество"], ["unwanted_content", "Нежелательный контент"],
  ["impersonation", "Выдаёт себя за другого"], ["other", "Другое"],
] as const;

export function ReportDialog({ targetType, targetId, onClose, onSuccess }: { targetType: "user" | "message"; targetId: string; onClose: () => void; onSuccess: () => void }) {
  const ref = useModalA11y(onClose);
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
  return <div className="fz-action-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} tabIndex={-1} className="fz-action-dialog" role="dialog" aria-modal="true" aria-labelledby="fz-report-title">
      <h2 id="fz-report-title">Пожаловаться на {targetType === "user" ? "пользователя" : "сообщение"}</h2><p>Укажите причину, чтобы модераторы могли разобраться.</p>
      <form ref={formRef} onSubmit={submit}><label>Причина<select name="reason" required>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Комментарий (необязательно)<textarea name="description" maxLength={2000} rows={4} placeholder="Опишите, что произошло" /></label>
        {error ? <p role="alert" className="fz-action-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose} disabled={busy}>Отмена</button><button disabled={busy}>{busy ? "Отправляем…" : "Отправить жалобу"}</button></footer>
      </form>
    </section>
  </div>;
}
