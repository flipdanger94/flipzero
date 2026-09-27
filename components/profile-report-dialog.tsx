"use client";
import type { FormEvent } from "react";
import { Dialog } from "./ui/dialog";
export function ProfileReportDialog({
  username,
  notice,
  busy,
  onClose,
  onSubmit,
}: {
  username: string;
  notice?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog
      backdropClassName="fz-profile-report-backdrop"
      label="Пожаловаться на профиль"
      onClose={onClose}
    >
      <form className="fz-profile-report" onSubmit={onSubmit}>
        <h3>Пожаловаться на профиль</h3>
        <p>@{username}</p>
      {notice ? <p role="alert">{notice}</p> : null}
        <label>
          Причина
          <select name="reason" defaultValue="harassment">
            <option value="harassment">Оскорбления / травля</option>
            <option value="spam">Спам</option>
            <option value="fraud">Мошенничество</option>
            <option value="impersonation">Выдаёт себя за другого</option>
            <option value="unwanted_content">Нежелательный контент</option>
            <option value="other">Другое</option>
          </select>
        </label>
        <label>
          Описание
          <textarea name="description" rows={4} maxLength={2000} />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button disabled={busy}>{busy ? "Отправляем…" : "Отправить"}</button>
        </footer>
      </form>
    </Dialog>
  );
}
