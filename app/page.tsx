"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Bell, BookOpen, ChevronDown, CirclePlus, Compass, Gamepad2, Gift, Hash, Headphones, HelpCircle, Image as ImageIcon, Mic, Plus, Search, SendHorizontal, Settings, Smile, Sparkles, Users, Volume2 } from "lucide-react";

const spaces = [{ label: "FZ", style: "space-logo" }, { label: "GG", style: "space-orchid" }, { label: "UX", style: "space-sky" }, { label: "24", style: "space-amber" }];
type Message = { initials: string; name: string; time: string; text: string; accent: string; reactions: string[]; badge?: string; quest?: boolean };

const generalMessages: Message[] = [
  { initials: "AP", name: "Alex Push", time: "Сегодня, 10:42", text: "Добро пожаловать в FlipZero! Здесь мы собираем первые идеи продукта и вместе решаем, каким станет наше сообщество.", accent: "avatar-coral", reactions: ["🔥  12", "✨  8"] },
  { initials: "MK", name: "Mira K.", time: "Сегодня, 10:46", text: "Новый профиль выглядит мощно. Особенно нравится, что уровень отражает реальную активность, а не просто количество сообщений.", accent: "avatar-violet", reactions: ["💜  6"] },
  { initials: "ZS", name: "Zero System", time: "Сегодня, 10:48", text: "Еженедельный челлендж открыт: проведите 30 минут в голосовых комнатах и получите значок «На одной волне».", accent: "avatar-lime", badge: "БОТ", quest: true, reactions: [] },
];
const initialChannelMessages: Record<string, Message[]> = {
  "общий-чат": generalMessages,
  "добро-пожаловать": [{ initials: "ZS", name: "Zero System", time: "Сегодня, 09:00", text: "Рады видеть вас в FlipZero. Выберите каналы по интересам, настройте профиль и познакомьтесь с участниками пространства.", accent: "avatar-lime", badge: "БОТ", reactions: ["👋  18"] }],
  "правила": [{ initials: "AP", name: "Alex Push", time: "Сегодня, 09:05", text: "Уважайте друг друга, не публикуйте спам и используйте подходящие каналы. Наша цель — создать пространство, куда хочется возвращаться.", accent: "avatar-coral", reactions: ["✅  21"] }],
  "творчество": [{ initials: "MK", name: "Mira K.", time: "Сегодня, 11:02", text: "Делитесь здесь дизайнами, музыкой, иллюстрациями и всем, что создаёте. Незавершённые идеи тоже приветствуются.", accent: "avatar-violet", reactions: ["🎨  9"] }],
  "игры": [{ initials: "NN", name: "Nana", time: "Сегодня, 11:18", text: "Кто сегодня вечером в кооператив? Собираем команду из четырёх человек.", accent: "avatar-amber", reactions: ["🎮  4"] }],
};
const channelDetails: Record<string, { title: string; description: string }> = {
  "общий-чат": { title: "Добро пожаловать в общий чат", description: "Знакомьтесь, делитесь идеями и создавайте что-то новое вместе." },
  "добро-пожаловать": { title: "Начните знакомство с FlipZero", description: "Всё необходимое, чтобы быстро освоиться в пространстве." },
  "правила": { title: "Правила пространства", description: "Простые принципы комфортного и безопасного общения." },
  "творчество": { title: "Покажите, что вы создаёте", description: "Работы, процессы, идеи и поддержка от сообщества." },
  "игры": { title: "Играем вместе", description: "Ищите команду, договаривайтесь о сессиях и делитесь моментами." },
};
const members = [
  { initials: "AP", name: "Alex Push", status: "Создаёт будущее", level: 12, accent: "avatar-coral" },
  { initials: "MK", name: "Mira K.", status: "В общем чате", level: 9, accent: "avatar-violet" },
  { initials: "IL", name: "Ilya", status: "Слушает музыку", level: 7, accent: "avatar-sky" },
  { initials: "NN", name: "Nana", status: "В игре", level: 5, accent: "avatar-amber" },
];

export default function Home() {
  const [channelMessages, setChannelMessages] = useState(initialChannelMessages);
  const [draft, setDraft] = useState("");
  const [activeChannel, setActiveChannel] = useState("общий-чат");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("flipzero:messages:v2");
    if (saved) {
      try {
        setChannelMessages(JSON.parse(saved) as Record<string, Message[]>);
      } catch {
        window.localStorage.removeItem("flipzero:messages:v2");
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem("flipzero:messages:v2", JSON.stringify(channelMessages));
  }, [channelMessages, storageReady]);

  const activeMessages = channelMessages[activeChannel] ?? [];
  const activeDetails = channelDetails[activeChannel] ?? { title: activeChannel, description: "Канал пространства FlipZero." };
  const visibleMessages = activeMessages.filter((message) => {
    const query = searchQuery.trim().toLocaleLowerCase("ru");
    return !query || message.text.toLocaleLowerCase("ru").includes(query) || message.name.toLocaleLowerCase("ru").includes(query);
  });

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setChannelMessages((current) => ({ ...current, [activeChannel]: [...(current[activeChannel] ?? []), { initials: "AP", name: "Alex Push", time: "Только что", text, accent: "avatar-coral", reactions: [] }] }));
    setDraft("");
  }

  function selectChannel(channel: string) {
    setActiveChannel(channel);
    setSearchQuery("");
    setDraft("");
  }

  return (
    <main className={`app-shell ${showMembers ? "" : "members-hidden"}`}>
      <nav className="space-rail" aria-label="Сообщества">
        <button className="rail-action home-action" aria-label="Главная"><Sparkles size={21} /></button>
        <span className="rail-separator" />
        {spaces.map((space, index) => <button key={space.label} className={`space-button ${space.style} ${index === 0 ? "active" : ""}`} aria-label={`Сообщество ${space.label}`}>{space.label}</button>)}
        <button className="rail-action add-space" aria-label="Добавить сообщество"><Plus size={22} /></button>
        <button className="rail-action discover" aria-label="Обзор сообществ"><Compass size={21} /></button>
        <div className="rail-bottom"><button className="rail-action" aria-label="Помощь"><HelpCircle size={20} /></button></div>
      </nav>

      <aside className="channel-panel">
        <button className="space-heading"><span className="brand-mark">FZ</span><span><strong>FlipZero</strong><small>Пространство команды</small></span><ChevronDown size={17} /></button>
        <div className="channel-scroll">
          <button className="boost-card"><span className="boost-icon"><Sparkles size={17} /></span><span><strong>Уровень пространства</strong><small>2 из 5 усилений</small></span><span className="boost-level">2</span></button>
          <ChannelGroup title="СТАРТ"><Channel icon={<Hash size={17} />} label="добро-пожаловать" active={activeChannel === "добро-пожаловать"} onSelect={selectChannel} /><Channel icon={<BookOpen size={17} />} label="правила" active={activeChannel === "правила"} onSelect={selectChannel} /></ChannelGroup>
          <ChannelGroup title="ОБЩЕНИЕ" action><Channel active={activeChannel === "общий-чат"} icon={<Hash size={17} />} label="общий-чат" badge="24" onSelect={selectChannel} /><Channel icon={<Hash size={17} />} label="творчество" active={activeChannel === "творчество"} onSelect={selectChannel} /><Channel icon={<Gamepad2 size={17} />} label="игры" active={activeChannel === "игры"} onSelect={selectChannel} /></ChannelGroup>
          <ChannelGroup title="ГОЛОСОВЫЕ" action><Channel icon={<Volume2 size={17} />} label="Лаунж" voice /><div className="voice-people"><span className="mini-avatar avatar-violet">MK</span><span className="voice-name">Mira K.</span><Mic size={13} /></div><Channel icon={<Volume2 size={17} />} label="Фокус-комната" /></ChannelGroup>
        </div>
        <div className="user-dock"><div className="avatar avatar-coral">AP<span className="presence" /></div><div className="dock-copy"><strong>Alex Push</strong><small>Уровень 12</small></div><button aria-label="Микрофон"><Mic size={17} /></button><button aria-label="Наушники"><Headphones size={17} /></button><button aria-label="Настройки"><Settings size={17} /></button></div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header"><div className="channel-title"><Hash size={21} /><strong>{activeChannel}</strong><span>Разговоры обо всём</span></div><div className="header-actions"><button className={notifications ? "is-active" : ""} aria-label={notifications ? "Выключить уведомления" : "Включить уведомления"} aria-pressed={notifications} onClick={() => setNotifications((value) => !value)}><Bell size={19} /></button><button className={showMembers ? "is-active" : ""} aria-label={showMembers ? "Скрыть участников" : "Показать участников"} aria-pressed={showMembers} onClick={() => setShowMembers((value) => !value)}><Users size={19} /></button><label className="search-box"><Search size={16} /><input aria-label="Поиск" placeholder="Поиск" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label></div></header>
        <div className="message-list">
          <div className="channel-intro"><div className="intro-icon"><Hash size={31} /></div><h1>{activeDetails.title}</h1><p>Это начало канала <strong>#{activeChannel}</strong>. {activeDetails.description}</p></div>
          <div className="day-divider"><span>17 сентября 2026</span></div>
          {visibleMessages.map((message) => (
            <article className="message" key={message.name}>
              <div className={`avatar ${message.accent}`}>{message.initials}</div>
              <div className="message-body"><div className="message-meta"><strong>{message.name}</strong>{message.badge && <span className="bot-badge">{message.badge}</span>}<time>{message.time}</time></div><p>{message.text}</p>
                {message.quest && <div className="quest-card"><div className="quest-symbol"><Gift size={22} /></div><div><small>ЕЖЕНЕДЕЛЬНЫЙ ЧЕЛЛЕНДЖ</small><strong>На одной волне</strong><span>Прогресс: 18 из 30 минут</span><div className="progress"><i /></div></div><b>+250 XP</b></div>}
                {message.reactions.length > 0 && <div className="reactions">{message.reactions.map((reaction) => <button key={reaction}>{reaction}</button>)}</div>}
              </div>
            </article>
          ))}
          {visibleMessages.length === 0 && <div className="search-empty"><Search size={24} /><strong>Ничего не найдено</strong><span>Попробуйте изменить поисковый запрос.</span></div>}
        </div>
        <div className="composer-wrap"><div className="typing"><span /><span /><span /> Mira печатает...</div><form className="composer" onSubmit={sendMessage}><button type="button" aria-label="Добавить"><CirclePlus size={22} /></button><textarea aria-label="Сообщение" placeholder={`Написать в #${activeChannel}`} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="button" aria-label="Изображение"><ImageIcon size={20} /></button><button type="button" aria-label="Эмодзи"><Smile size={20} /></button><button className="send-button" type="submit" aria-label="Отправить" disabled={!draft.trim()}><SendHorizontal size={18} /></button></form></div>
      </section>

      <aside className="member-panel">
        <div className="profile-card"><div className="profile-art"><span>FLIP<br />ZERO</span></div><div className="profile-avatar avatar-coral">AP<span className="presence" /></div><div className="profile-copy"><strong>Alex Push</strong><span>@flipdanger · Основатель</span></div><div className="level-row"><span>Уровень 12</span><b>2 840 / 3 200 XP</b></div><div className="profile-progress"><i /></div><div className="profile-stats"><span><b>24</b><small>дня подряд</small></span><span><b>18</b><small>достижений</small></span><span><b>4</b><small>пути</small></span></div></div>
        <div className="member-section"><h2>В СЕТИ — 4</h2>{members.map((member) => <button className="member" key={member.name}><span className={`mini-avatar ${member.accent}`}>{member.initials}<i /></span><span><strong>{member.name}</strong><small>{member.status}</small></span><b>{member.level}</b></button>)}</div>
        <div className="achievement"><div className="achievement-icon">✦</div><div><small>ПОЧТИ ПОЛУЧЕНО</small><strong>Ранний участник</strong><span>92% выполнено</span></div></div>
      </aside>
    </main>
  );
}

function ChannelGroup({ title, action = false, children }: { title: string; action?: boolean; children: React.ReactNode }) {
  return <section className="channel-group"><h2><span>{title}</span>{action && <button aria-label={`Добавить в ${title}`}><Plus size={15} /></button>}</h2>{children}</section>;
}
function Channel({ icon, label, active = false, badge, voice = false, onSelect }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; voice?: boolean; onSelect?: (channel: string) => void }) {
  return <button className={`channel ${active ? "active" : ""}`} onClick={() => onSelect?.(label)}><span>{icon}</span><strong>{label}</strong>{voice && <span className="live-pill">LIVE</span>}{badge && <b>{badge}</b>}</button>;
}
