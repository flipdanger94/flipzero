"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ClipboardList, Gem, LoaderCircle, Settings2, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { ImageUpload } from "./image-upload";
import { MediaImage } from "./media-image";
import { useModalA11y } from "@/hooks/use-modal-a11y";

export type EditableSpace = { id: string; name: string; description: string | null; visibility?: string; accentColor: string; iconUrl?: string | null; bannerUrl?: string | null };
type Props = { space: EditableSpace; onClose: () => void; onSaved: (space: EditableSpace, close?: boolean) => void; onRoles?: () => void; onMembers?: () => void; onInvites?: () => void; onModeration?: () => void; onProgress?: () => void };

export function SpaceSettingsDialog({ space, onClose, onSaved, onRoles, onMembers, onInvites, onModeration, onProgress }: Props) {
  const dialogRef = useModalA11y(onClose);
  const [section, setSection] = useState<"profile" | "superup" | "people" | "analytics" | "moderation">("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [support, setSupport] = useState<{ count: number; level: number; retainedLevel: number; graceUntil: string | null; supporters: { userId: string; displayName: string }[]; mySpaceId: string | null; canSupport: boolean } | null>(null);
  const [analytics, setAnalytics] = useState<{ members: number; channels: number; messages: number; weeklyMessages: number; weeklyJoins: number } | null>(null);
  const [supportError, setSupportError] = useState("");
  const loadSupport = useCallback(async () => { const response = await fetch(`/api/v1/spaces/${space.id}/superup`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Не удалось загрузить поддержку."); setSupport(data); }, [space.id]);
  useEffect(() => { if (section === "analytics") void fetch(`/api/v1/spaces/${space.id}/analytics`).then((response) => response.json()).then(setAnalytics).catch(() => setError("Не удалось загрузить статистику.")); }, [section, space.id]);
  useEffect(() => { if (section === "superup") void fetch(`/api/v1/spaces/${space.id}/superup`, { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Не удалось загрузить поддержку."); return data; }).then(setSupport).catch((reason) => setSupportError(reason.message)); }, [section, space.id]);
  async function toggleSupport() { setLoading(true); setSupportError(""); try { const response = await fetch(`/api/v1/spaces/${space.id}/superup`, { method: support?.mySpaceId === space.id ? "DELETE" : "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Не удалось обновить поддержку."); await loadSupport(); } catch (reason) { setSupportError(reason instanceof Error ? reason.message : "Ошибка поддержки."); } finally { setLoading(false); } }
  const [images, setImages] = useState({ iconUrl: space.iconUrl, bannerUrl: space.bannerUrl });
  function mediaSaved(result: { space?: Record<string, unknown> }) {
    const next = (result.space ?? {}) as Partial<EditableSpace>;
    setImages((current) => ({ ...current, ...next }));
    onSaved({ ...space, ...images, ...next }, false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/v1/spaces/${space.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), description: data.get("description"), visibility: data.get("visibility"), accentColor: data.get("accentColor") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Не удалось сохранить настройки.");
      onSaved(result.space);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить настройки."); }
    finally { setLoading(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="space-dialog space-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>
      <aside className="space-settings-nav" aria-label="Разделы настроек">
        <strong className="space-settings-nav-title">{space.name}</strong>
        <small>ОБЩЕЕ</small>
        <button type="button" className={section === "profile" ? "active" : ""} onClick={() => setSection("profile")}><Settings2 size={17} /> Профиль пространства</button>
        <small>ПОДДЕРЖКА</small>
        <button type="button" className={section === "superup" ? "active" : ""} onClick={() => setSection("superup")}><Gem size={17} /> Бонусы SuperUp</button>
        <small>ЛЮДИ</small>
        <button type="button" className={section === "people" ? "active" : ""} onClick={() => setSection("people")}><Users size={17} /> Участники и роли</button>
        <small>СТАТИСТИКА</small>
        <button type="button" className={section === "analytics" ? "active" : ""} onClick={() => setSection("analytics")}><Settings2 size={17} /> Аналитика</button>
        <small>БЕЗОПАСНОСТЬ</small>
        <button type="button" className={section === "moderation" ? "active" : ""} onClick={() => setSection("moderation")}><ShieldCheck size={17} /> Модерация</button>
      </aside>
      <div className="space-settings-content">
        {section === "profile" ? <>
          <div className="space-settings-heading"><span>ОБЩЕЕ</span><h2 id="settings-title">Профиль пространства</h2><p>Название, оформление и доступность сообщества.</p></div>
          <div className="space-settings-preview" aria-label="Предпросмотр оформления пространства"><div className="space-media-banner" style={images.bannerUrl ? { backgroundImage: `url(${images.bannerUrl})` } : undefined} /><div><span className="space-media-icon">{images.iconUrl ? <MediaImage src={images.iconUrl} sizes="72px" /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</span><strong>{space.name}</strong><small>{space.description || "Ваше пространство в FlipZero"}</small></div></div>
          <div className="space-media-controls"><ImageUpload kind="spaceIcon" spaceId={space.id} label="Загрузить иконку" currentUrl={images.iconUrl} onUploaded={mediaSaved} /><ImageUpload kind="spaceBanner" spaceId={space.id} label="Загрузить баннер 16:9" currentUrl={images.bannerUrl} onUploaded={mediaSaved} /><small>Изображения до 30 МБ сжимаются автоматически. Баннер отображается в формате 16:9.</small></div>
          <form onSubmit={submit}>{error ? <div className="auth-error" role="alert">{error}</div> : null}<label><span>Название</span><input name="name" defaultValue={space.name} minLength={2} maxLength={48} required /></label><label><span>Описание</span><textarea name="description" defaultValue={space.description ?? ""} maxLength={240} rows={3} /></label><div className="dialog-row"><label><span>Доступ</span><select name="visibility" defaultValue={space.visibility ?? "invite_only"}><option value="invite_only">По приглашению</option><option value="public">Открытое</option><option value="application">По заявке</option><option value="private">Закрытое</option></select></label><label><span>Акцент</span><input className="color-input" name="accentColor" type="color" defaultValue={space.accentColor} aria-label="Акцентный цвет пространства" /></label></div><button className="auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Сохраняем…</> : "Сохранить изменения"}</button></form>
        </> : section === "superup" ? <><div className="space-settings-heading"><span>SUPERUP · {space.name}</span><h2 id="settings-title">Поддержка пространства</h2><p>Участник с действующим SuperFlip может поддерживать одно пространство. Поддержку можно отменить в любой момент.</p></div><div className="space-superup-levels"><article><b>Поддержка</b><strong>{support ? `${support.count} участников` : "Загрузка…"}</strong><span>Уровень {support?.level ?? 0} из 3</span><p>Пороги: 2, 7 и 14 участников.</p></article><article><b>Участники</b><strong>Бейдж поддержки</strong><p>{support?.supporters.length ? support.supporters.map((item) => item.displayName).join(", ") : "Пока никто не поддерживает это пространство."}</p></article><article><b>Переход</b><strong>{support?.graceUntil ? `До ${new Date(support.graceUntil).toLocaleDateString("ru-RU")}` : "Без льготного периода"}</strong><p>{support?.graceUntil ? `Уровень ${support.retainedLevel} сохраняется на семь дней после окончания поддержки.` : "После истечения SuperFlip поддержка прекращается; прежний уровень сохраняется семь дней."}</p></article></div>{supportError ? <p className="auth-error" role="alert">{supportError}</p> : null}{support?.mySpaceId === space.id ? <button className="auth-submit" disabled={loading} onClick={() => void toggleSupport()}>Отменить мою поддержку</button> : <button className="auth-submit" disabled={loading || !support?.canSupport || Boolean(support.mySpaceId)} onClick={() => void toggleSupport()}>{support?.mySpaceId ? "Вы поддерживаете другое пространство" : support?.canSupport ? "Поддержать пространство" : "Доступно с активным SuperFlip"}</button>}<p className="space-superup-note">Уровни отражают число поддерживающих участников. Дополнительные функции уровней будут включены после их запуска.</p></> : section === "people" ? <><div className="space-settings-heading"><span>ЛЮДИ</span><h2 id="settings-title">Участники и роли</h2><p>Управление составом и доступом к пространству.</p></div><div className="space-settings-actions">{onMembers ? <button onClick={onMembers}><Users size={20} /><span><strong>Участники</strong><small>Список, управление и исключение участников</small></span></button> : null}{onRoles ? <button onClick={onRoles}><UserRound size={20} /><span><strong>Роли и права</strong><small>Разрешения и бейджи рядом с именами</small></span></button> : null}{onInvites ? <button onClick={onInvites}><ClipboardList size={20} /><span><strong>Приглашения</strong><small>Ссылки и доступ по приглашению</small></span></button> : null}</div></> : section === "analytics" ? <><div className="space-settings-heading"><span>СТАТИСТИКА</span><h2 id="settings-title">Аналитика пространства</h2><p>Текущие данные и активность за последние семь дней.</p></div><div className="space-superup-levels"><article><b>Участники</b><strong>{analytics?.members ?? "…"}</strong><p>Новых за неделю: {analytics?.weeklyJoins ?? "…"}</p></article><article><b>Каналы</b><strong>{analytics?.channels ?? "…"}</strong></article><article><b>Сообщения</b><strong>{analytics?.messages ?? "…"}</strong><p>За неделю: {analytics?.weeklyMessages ?? "…"}</p></article></div>{error ? <p role="alert">{error}</p> : null}</> : <><div className="space-settings-heading"><span>БЕЗОПАСНОСТЬ</span><h2 id="settings-title">Модерация</h2><p>Инструменты для защиты сообщества.</p></div><div className="space-settings-actions">{onModeration ? <button onClick={onModeration}><ShieldCheck size={20} /><span><strong>Журнал и действия модерации</strong><small>Жалобы и принятые меры</small></span></button> : null}{onProgress ? <button onClick={onProgress}><Gem size={20} /><span><strong>Прогресс и достижения</strong><small>Настройка достижений и рейтинг</small></span></button> : null}</div></>}
      </div>
    </section>
  </div>;
}
