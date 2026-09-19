"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, KeyRound, LoaderCircle, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { BrandMark } from "./brand-mark";

export type AccountProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  globalLevel: number;
  globalXp: number;
};

type Section = "profile" | "security";

export function AccountSettingsDialog({ user, onClose, onSaved }: { user: AccountProfile; onClose: () => void; onSaved: (user: AccountProfile) => void }) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bio, setBio] = useState(user.bio ?? "");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  function openSection(next: Section) { setSection(next); setError(""); setSuccess(""); }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), username: form.get("username"), bio: form.get("bio") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "Не удалось сохранить профиль."); return; }
      onSaved(result.user);
      setSuccess("Профиль сохранён.");
    } catch { setError("Нет соединения. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError("Новые пароли не совпадают."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "Не удалось изменить пароль."); return; }
      formElement.reset();
      setSuccess("Пароль изменён.");
    } catch { setError("Нет соединения. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/");
      router.refresh();
    } catch { setError("Не удалось выйти. Попробуйте ещё раз."); setBusy(false); }
  }

  const initials = user.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("ru");

  return <div className="dialog-backdrop account-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="account-settings" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
      <aside className="account-settings-nav">
        <div className="account-settings-brand"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></div>
        <small className="account-nav-label">НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ</small>
        <button type="button" className={section === "profile" ? "active" : ""} onClick={() => openSection("profile")}><UserRound size={18} /> Мой профиль</button>
        <button type="button" className={section === "security" ? "active" : ""} onClick={() => openSection("security")}><ShieldCheck size={18} /> Аккаунт и безопасность</button>
        <div className="account-nav-spacer" />
        <button type="button" className="account-logout" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        <div className="account-nav-user"><span>{initials}</span><div><strong>{user.displayName}</strong><small>@{user.username}</small></div></div>
      </aside>

      <div className="account-settings-content">
        <button ref={closeRef} className="account-settings-close" onClick={onClose} aria-label="Закрыть настройки"><X size={20} /></button>
        {section === "profile" ? <>
          <div className="account-settings-heading"><span>ПРОФИЛЬ</span><h2 id="account-settings-title">Мой профиль</h2><p>Так вас видят другие участники FlipZero.</p></div>
          <div className="account-profile-preview"><div className="account-profile-banner" /><div className="account-profile-details"><span className="account-profile-avatar">{initials}</span><strong>{user.displayName}</strong><small>@{user.username} · уровень {user.globalLevel}</small><p>{user.bio || "Расскажите немного о себе."}</p></div></div>
          <form className="account-settings-form" onSubmit={saveProfile}>
            <label><span>Отображаемое имя</span><input name="displayName" defaultValue={user.displayName} minLength={2} maxLength={40} required autoComplete="nickname" /></label>
            <label><span>Никнейм</span><div className="account-field-icon"><AtSign size={17} /><input name="username" defaultValue={user.username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required autoComplete="username" /></div><small>Латинские буквы, цифры и нижнее подчёркивание.</small></label>
            <label><span>О себе</span><textarea name="bio" value={bio} maxLength={190} rows={3} placeholder="Пара слов о вас" onChange={(event) => setBio(event.target.value)} /><small>{bio.length}/190</small></label>
            {error ? <div className="account-feedback error" role="alert">{error}</div> : null}
            {success ? <div className="account-feedback success" role="status"><Check size={16} />{success}</div> : null}
            <button className="account-primary" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" /> Сохраняем…</> : "Сохранить профиль"}</button>
          </form>
          <button className="account-signout-mobile" type="button" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        </> : <>
          <div className="account-settings-heading"><span>БЕЗОПАСНОСТЬ</span><h2 id="account-settings-title">Аккаунт и безопасность</h2><p>Ваш адрес для входа и пароль.</p></div>
          <div className="account-email-card"><strong>Электронная почта</strong><span>{user.email}</span><small>Этот адрес используется для входа в FlipZero.</small></div>
          <form className="account-settings-form" onSubmit={changePassword}>
            <h3><KeyRound size={19} /> Изменить пароль</h3>
            <label><span>Текущий пароль</span><input type="password" name="currentPassword" autoComplete="current-password" required /></label>
            <label><span>Новый пароль</span><input type="password" name="newPassword" minLength={10} maxLength={128} autoComplete="new-password" required /><small>Не менее 10 символов.</small></label>
            <label><span>Повторите новый пароль</span><input type="password" name="confirmPassword" minLength={10} maxLength={128} autoComplete="new-password" required /></label>
            {error ? <div className="account-feedback error" role="alert">{error}</div> : null}
            {success ? <div className="account-feedback success" role="status"><Check size={16} />{success}</div> : null}
            <button className="account-primary" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" /> Обновляем…</> : "Изменить пароль"}</button>
          </form>
          <button className="account-signout-mobile" type="button" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        </>}
      </div>
    </section>
  </div>;
}
