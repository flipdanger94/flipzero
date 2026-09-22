"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle, ShieldAlert, X } from "lucide-react";

const reasons = [
  ["spam", "Спам"],
  ["abuse", "Оскорбления или агрессия"],
  ["harassment", "Домогательства или травля"],
  ["fraud", "Мошенничество"],
  ["unwanted_content", "Нежелательный контент"],
  ["impersonation", "Выдаёт себя за другого"],
  ["other", "Другое"],
] as const;

export function ReportDialog({
  targetType,
  targetId,
  title,
  onClose,
  onSubmitted,
}: {
  targetType: "message" | "user";
  targetId: string;
  title: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>("other");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, description }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? "Не удалось отправить жалобу.");
        return;
      }
      onSubmitted?.();
      onClose();
    } catch {
      setError("Не удалось отправить жалобу. Проверьте соединение.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <button className="report-close" type="button" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
        <div className="report-symbol"><ShieldAlert size={20} /></div>
        <small>TRUST &amp; SAFETY</small>
        <h2 id="report-title">Пожаловаться</h2>
        <p>{title}</p>
        <form onSubmit={submit}>
          <label>
            <span>Причина</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as (typeof reasons)[number][0])}>
              {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Что произошло? <em>необязательно</em></span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
              rows={5}
              placeholder="Добавьте детали, которые помогут модерации разобраться."
            />
            <b>{description.length}/2000</b>
          </label>
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <div className="report-actions">
            <button type="button" className="secondary-action" onClick={onClose} disabled={busy}>Отмена</button>
            <button type="submit" className="report-submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={15} /> : <ShieldAlert size={15} />}
              {busy ? "Отправляем…" : "Отправить жалобу"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
