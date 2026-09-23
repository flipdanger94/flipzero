"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { AtSign, Bell, Check, Crown, Gem, Headphones, KeyRound, LoaderCircle, LogOut, Mic, Palette, RefreshCw, ShieldCheck, UserRound, Volume2, X, UserX } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ImageUpload } from "./image-upload";
import { SecurityCenter } from "./security-center";
import { MediaImage } from "./media-image";

export type AccountProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  globalLevel: number;
  globalXp: number;
  platformRole?: "user" | "admin";
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  totpEnabled?: boolean;
};

export type AccountSettingsSection = "profile" | "security" | "privacy" | "notifications" | "voice" | "appearance" | "superflip" | "superup";

export function AccountSettingsDialog({ user, initialSection = "profile", onClose, onSaved }: { user: AccountProfile; initialSection?: AccountSettingsSection; onClose: () => void; onSaved: (user: AccountProfile) => void }) {
  const router = useRouter();
  const dialogRef = useModalA11y(onClose);
  const [section, setSection] = useState<AccountSettingsSection>(initialSection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bio, setBio] = useState(user.bio ?? "");
  const [media, setMedia] = useState({ avatarUrl: user.avatarUrl, bannerUrl: user.bannerUrl });
  const [superflipBioLimit, setSuperflipBioLimit] = useState(190);
  useEffect(() => { void fetch("/api/superflip/status").then((response) => response.json()).then((status: { capabilities?: { profileBioLimit?: number } }) => setSuperflipBioLimit(status.capabilities?.profileBioLimit ?? 190)).catch(() => {}); }, []);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  function openSection(next: AccountSettingsSection) { setSection(next); setError(""); setSuccess(""); }

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
    <section ref={dialogRef} tabIndex={-1} className="account-settings" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
      <aside className="account-settings-nav">
        <div className="account-settings-brand"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></div>
        <small className="account-nav-label">НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ</small>
        <button type="button" className={section === "profile" ? "active" : ""} onClick={() => openSection("profile")}><UserRound size={18} /> Мой профиль</button>
        <button type="button" className={section === "security" ? "active" : ""} onClick={() => openSection("security")}><ShieldCheck size={18} /> Аккаунт и безопасность</button>
        <button type="button" className={section === "privacy" ? "active" : ""} onClick={() => openSection("privacy")}><ShieldCheck size={18} /> Приватность</button>
        <button type="button" className={section === "notifications" ? "active" : ""} onClick={() => openSection("notifications")}><Bell size={18} /> Уведомления</button>
        <small className="account-nav-label account-nav-group">НАСТРОЙКИ ПРИЛОЖЕНИЯ</small>
        <button type="button" className={section === "voice" ? "active" : ""} onClick={() => openSection("voice")}><Headphones size={18} /> Голос и видео</button>
        <button type="button" className={section === "appearance" ? "active" : ""} onClick={() => openSection("appearance")}><Palette size={18} /> Внешний вид</button>
        <small className="account-nav-label account-nav-group">FLIPZERO</small>
        <button type="button" className={`account-premium-nav ${section === "superflip" ? "active" : ""}`} onClick={() => openSection("superflip")}><Crown size={18} /> SuperFlip</button>
        <button type="button" className={`account-superup-nav ${section === "superup" ? "active" : ""}`} onClick={() => openSection("superup")}><Gem size={18} /> О SuperUp</button>
        <div className="account-nav-spacer" />
        <button type="button" className="account-logout" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        <div className="account-nav-user"><span>{media.avatarUrl ? <MediaImage src={media.avatarUrl} /> : initials}</span><div><strong>{user.displayName}</strong><small>@{user.username}</small></div></div>
      </aside>

      <div className="account-settings-content">
        <button className="account-settings-close" onClick={onClose} aria-label="Закрыть настройки"><X size={20} /></button>
        {section === "profile" ? <>
          <div className="account-settings-heading"><span>ПРОФИЛЬ</span><h2 id="account-settings-title">Мой профиль</h2><p>Так вас видят другие участники FlipZero.</p></div>
          <div className="account-profile-preview"><div className="account-profile-banner" style={media.bannerUrl ? { backgroundImage: `url(${media.bannerUrl})` } : undefined} /><div className="account-profile-details"><span className="account-profile-avatar">{media.avatarUrl ? <MediaImage src={media.avatarUrl} sizes="88px" /> : initials}</span><strong>{user.displayName}</strong><small>@{user.username} · уровень {user.globalLevel}</small><p>{user.bio || "Расскажите немного о себе."}</p></div></div>
          <div className="account-media-controls"><ImageUpload kind="avatar" label="Загрузить аватарку" currentUrl={media.avatarUrl} onUploaded={(result) => { const next = result.user as AccountProfile; setMedia({ avatarUrl: next.avatarUrl, bannerUrl: next.bannerUrl }); onSaved(next); }} /><ImageUpload kind="accountBanner" label="Загрузить баннер" currentUrl={media.bannerUrl} onUploaded={(result) => { const next = result.user as AccountProfile; setMedia({ avatarUrl: next.avatarUrl, bannerUrl: next.bannerUrl }); onSaved(next); }} /><small>Лимиты SuperFlip: аватар до 8 МБ, баннер до 16 МБ · GIF и расширенные лимиты доступны после активации.</small></div>
          <form className="account-settings-form" onSubmit={saveProfile}>
            <label><span>Отображаемое имя</span><input name="displayName" defaultValue={user.displayName} minLength={2} maxLength={40} required autoComplete="nickname" /></label>
            <label><span>Никнейм</span><div className="account-field-icon"><AtSign size={17} /><input name="username" defaultValue={user.username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required autoComplete="username" /></div><small>Латинские буквы, цифры и нижнее подчёркивание.</small></label>
            <label><span>О себе</span><textarea name="bio" value={bio} maxLength={superflipBioLimit} rows={3} placeholder="Пара слов о вас" onChange={(event) => setBio(event.target.value)} /><small>{bio.length}/{superflipBioLimit}{superflipBioLimit > 190 ? " · SuperFlip" : ""}</small></label>
            {error ? <div className="account-feedback error" role="alert">{error}</div> : null}
            {success ? <div className="account-feedback success" role="status"><Check size={16} />{success}</div> : null}
            <button className="account-primary" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" /> Сохраняем…</> : "Сохранить профиль"}</button>
          </form>
          <button className="account-signout-mobile" type="button" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        </> : section === "security" ? <>
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
          <SecurityCenter />
          <button className="account-signout-mobile" type="button" onClick={signOut} disabled={busy}><LogOut size={18} /> Выйти из аккаунта</button>
        </> : section === "privacy" ? <PreferencesSection kind="privacy" />
          : section === "notifications" ? <PreferencesSection kind="notifications" />
          : section === "voice" ? <VoiceDeviceSettings />
          : section === "appearance" ? <AppearanceSettings />
          : section === "superflip" ? <SuperFlipSettings />
          : <SuperUpSettings />}
      </div>
    </section>
  </div>;
}

const preferenceDefaults = {
  friendRequests: true,
  directMessages: true,
  profileDiscovery: true,
  messageSounds: true,
  desktopNotifications: true,
  mentionsOnly: false,
};
type Preferences = typeof preferenceDefaults;

function readPreferences(): Preferences {
  if (typeof window === "undefined") return preferenceDefaults;
  try { return { ...preferenceDefaults, ...JSON.parse(localStorage.getItem("flipzero:preferences:v1") ?? "{}") }; }
  catch { return preferenceDefaults; }
}

type BlockedUser = { id:string; username:string; displayName:string; avatarUrl?:string|null; createdAt:string };
function PreferencesSection({ kind }: { kind: "privacy" | "notifications" }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [privacyLoading,setPrivacyLoading]=useState(kind==="privacy");
  const [blocked,setBlocked]=useState<BlockedUser[]>([]); const [blockBusy,setBlockBusy]=useState("");
  useEffect(()=>{if(kind!=="privacy")return;let cancelled=false;void Promise.all([fetch("/api/privacy").then(r=>r.ok?r.json():null),fetch("/api/blocks").then(r=>r.ok?r.json():null)]).then(([privacyData,blocksData])=>{if(cancelled)return;if(privacyData?.privacy)setPreferences(current=>({...current,...privacyData.privacy}));if(blocksData?.blocked)setBlocked(blocksData.blocked)}).finally(()=>{if(!cancelled)setPrivacyLoading(false)});return()=>{cancelled=true}},[kind]);
  async function toggle(key: keyof typeof preferenceDefaults) {
    const next={...preferences,[key]:!preferences[key]}; setPreferences(next);
    if(kind==="privacy"&&(key==="directMessages"||key==="friendRequests"||key==="profileDiscovery")){
      const r=await fetch("/api/privacy",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(next)});
      if(!r.ok){setPreferences(preferences);return}
    } else localStorage.setItem("flipzero:preferences:v1",JSON.stringify(next));
  }
  async function unblock(id:string){setBlockBusy(id);const r=await fetch(`/api/blocks?userId=${encodeURIComponent(id)}`,{method:"DELETE"});if(r.ok)setBlocked(items=>items.filter(item=>item.id!==id));setBlockBusy("")}
  const items = kind === "privacy" ? [
    ["directMessages", "Личные сообщения", "Разрешить участникам общих серверов писать вам."],
    ["friendRequests", "Запросы в друзья", "Получать новые запросы в друзья."],
    ["profileDiscovery", "Публичный профиль", "Показывать профиль участникам FlipZero."],
  ] as const : [
    ["desktopNotifications", "Push-уведомления", "Получать уведомления о новых событиях."],
    ["messageSounds", "Звуки сообщений", "Воспроизводить звук при новом сообщении."],
    ["mentionsOnly", "Только упоминания", "Не отвлекать уведомлениями без упоминания."],
  ] as const;
  return <><SettingsHeading kicker={kind === "privacy" ? "КОНФИДЕНЦИАЛЬНОСТЬ" : "УВЕДОМЛЕНИЯ"} title={kind === "privacy" ? "Приватность и безопасность" : "Настройки уведомлений"} description={kind === "privacy" ? "Управляйте тем, кто может связаться с вами и видеть профиль." : "Выберите, какие события требуют вашего внимания."} />{privacyLoading?<div className="chat-loading"><LoaderCircle className="spin"/> Загружаем настройки…</div>:<div className="settings-list">{items.map(([key,title,description])=><label key={key} className="settings-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={preferences[key]} onChange={()=>void toggle(key)}/><i/></label>)}</div>}{kind==="privacy"?<div className="blocked-users-settings"><h3><UserX size={18}/> Заблокированные пользователи</h3><p>Заблокированные пользователи не могут отправлять вам личные сообщения или заявки в друзья.</p>{blocked.length?blocked.map(item=><article key={item.id}><span className="account-profile-avatar">{item.avatarUrl?<MediaImage src={item.avatarUrl}/>:item.displayName.slice(0,2)}</span><div><strong>{item.displayName}</strong><small>@{item.username}</small></div><button type="button" disabled={blockBusy===item.id} onClick={()=>void unblock(item.id)}>{blockBusy===item.id?"Подождите…":"Разблокировать"}</button></article>):<small>У вас нет заблокированных пользователей.</small>}</div>:null}</>;
}

type AudioDevices = { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] };

function VoiceDeviceSettings() {
  const [devices, setDevices] = useState<AudioDevices>({ inputs: [], outputs: [] });
  const [inputId, setInputId] = useState("");
  const [outputId, setOutputId] = useState("");
  const [notice, setNotice] = useState("");
  async function refresh(askPermission = false) {
    try {
      if (askPermission) { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop()); }
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((item) => item.kind === "audioinput");
      const outputs = all.filter((item) => item.kind === "audiooutput");
      const stored = JSON.parse(localStorage.getItem("flipzero:audio-devices:v1") ?? "{}");
      setDevices({ inputs, outputs });
      setInputId(stored.inputId && inputs.some((item) => item.deviceId === stored.inputId) ? stored.inputId : inputs[0]?.deviceId ?? "");
      setOutputId(stored.outputId && outputs.some((item) => item.deviceId === stored.outputId) ? stored.outputId : outputs[0]?.deviceId ?? "");
      setNotice(inputs.length ? "Устройства обнаружены." : "Разрешите доступ к микрофону, чтобы увидеть устройства.");
    } catch { setNotice("Браузер не предоставил доступ к аудиоустройствам."); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(false); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function save(nextInput = inputId, nextOutput = outputId) { localStorage.setItem("flipzero:audio-devices:v1", JSON.stringify({ inputId: nextInput, outputId: nextOutput })); setNotice("Выбор сохранён и будет применён в голосовой комнате."); }
  return <><SettingsHeading kicker="ГОЛОС И ВИДЕО" title="Аудиоустройства" description="Выберите микрофон и устройство вывода. Настройка сохраняется для следующих подключений." /><div className="audio-device-card"><label><span><Mic size={17} /> Устройство ввода</span><select value={inputId} onChange={(event) => { setInputId(event.target.value); save(event.target.value, outputId); }}>{devices.inputs.length ? devices.inputs.map((item, index) => <option key={item.deviceId} value={item.deviceId}>{item.label || `Микрофон ${index + 1}`}</option>) : <option>Микрофон не найден</option>}</select></label><label><span><Headphones size={17} /> Устройство вывода</span><select value={outputId} onChange={(event) => { setOutputId(event.target.value); save(inputId, event.target.value); }}>{devices.outputs.length ? devices.outputs.map((item, index) => <option key={item.deviceId} value={item.deviceId}>{item.label || `Наушники / динамики ${index + 1}`}</option>) : <option>Системное устройство</option>}</select></label><button type="button" className="security-action" onClick={() => void refresh(true)}><RefreshCw size={16} /> Обновить устройства</button>{notice ? <p>{notice}</p> : null}</div><div className="settings-callout"><Volume2 size={20} /><span><strong>Проверка звука</strong><small>Откройте голосовую комнату — сохранённые устройства подключатся автоматически.</small></span></div></>;
}

function AppearanceSettings() {
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && localStorage.getItem("flipzero:compact") === "1");
  const [motion, setMotion] = useState(() => typeof window === "undefined" || localStorage.getItem("flipzero:motion") !== "0");
  function update(key: "compact" | "motion", value: boolean) { localStorage.setItem(`flipzero:${key}`, value ? "1" : "0"); document.documentElement.dataset[key] = value ? "on" : "off"; }
  return <><SettingsHeading kicker="ВНЕШНИЙ ВИД" title="Персонализация интерфейса" description="Настройте плотность и движение интерфейса под себя." /><div className="settings-list"><label className="settings-row"><span><strong>Компактный режим</strong><small>Показывать больше каналов и сообщений на экране.</small></span><input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); update("compact", event.target.checked); }} /><i /></label><label className="settings-row"><span><strong>Анимации интерфейса</strong><small>Плавные переходы, появления и визуальные эффекты.</small></span><input type="checkbox" checked={motion} onChange={(event) => { setMotion(event.target.checked); update("motion", event.target.checked); }} /><i /></label></div></>;
}

function SuperFlipSettings() {
  const [status, setStatus] = useState<{ active?: boolean; waitlisted?: boolean; expiresAt?: string | null } | null>(null);
  useEffect(() => { void fetch("/api/superflip/status").then((response) => response.json()).then(setStatus).catch(() => setStatus({})); }, []);
  async function waitlist() { const response = await fetch("/api/superflip/purchase", { method: "POST" }); if (response.ok) setStatus((current) => ({ ...current, waitlisted: true })); }
  return <><SettingsHeading kicker="SUPERFLIP" title="Раскройте возможности FlipZero" description="Премиум-профиль, увеличенные загрузки и расширенные возможности общения." /><div className="premium-hero"><Crown size={38} /><div><strong>{status?.active ? "SuperFlip активен" : "SuperFlip — скоро"}</strong><span>{status?.active && status.expiresAt ? `Доступ до ${new Date(status.expiresAt).toLocaleDateString("ru-RU")}` : "Стоимость объявим перед запуском"}</span></div></div><div className="premium-settings-grid"><span>Профиль до 500 символов</span><span>Баннер до 16 МБ</span><span>Сообщения до 8000 символов</span><span>Анимированные медиа</span></div>{status?.active ? <button className="account-primary" disabled>SuperFlip подключён</button> : <button className="account-primary" onClick={() => void waitlist()} disabled={status?.waitlisted}>{status?.waitlisted ? "Вы в листе ожидания" : "Сообщить о запуске"}</button>}</>;
}

function SuperUpSettings() {
  return <><SettingsHeading kicker="SUPERUP" title="Поддержка пространств" description="SuperUp — планируемая система общих бонусов для участников пространства. Уровни конкретного пространства можно посмотреть в его настройках." /><div className="superup-levels"><article><b>1</b><strong>Старт</strong><span>План: 2 поддержки</span><small>Дополнительные эмодзи и качество голоса</small></article><article><b>2</b><strong>Рост</strong><span>План: 7 поддержек</span><small>Оформление и расширенные загрузки</small></article><article><b>3</b><strong>Максимум</strong><span>План: 14 поддержек</span><small>Дополнительные лимиты и персонализация</small></article></div><div className="settings-callout superup-callout"><Gem size={22} /><span><strong>SuperUp скоро</strong><small>Пороги и бонусы уточняются. Поддержка пока недоступна.</small></span></div></>;
}

function SettingsHeading({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="account-settings-heading"><span>{kicker}</span><h2 id="account-settings-title">{title}</h2><p>{description}</p></div>;
}
