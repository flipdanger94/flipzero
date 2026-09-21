import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, Download, Hash, KanbanSquare, Menu, MessageCircle, Mic2, MonitorUp, ShieldCheck, Trophy, Users, Video } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const features = [
  { icon: MessageCircle, title: "Чаты без ограничений", text: "Личные и групповые чаты, треды, реакции и файлы — без шума и искусственных лимитов." },
  { icon: Mic2, title: "Голос и видео", text: "Заходите в голос одним кликом, включайте камеру и делитесь экраном в высоком качестве." },
  { icon: Users, title: "Ваше сообщество", text: "Создавайте пространство с каналами, гибкими ролями, правами и понятной модерацией." },
];

const communityTools = [
  { icon: CalendarDays, title: "События", text: "Планируйте встречи, эфиры и игровые вечера." },
  { icon: BookOpen, title: "База знаний", text: "Сохраняйте правила, гайды и важные решения." },
  { icon: KanbanSquare, title: "Доски", text: "Организуйте идеи и задачи вместе с командой." },
  { icon: Trophy, title: "Уровни и награды", text: "Поддерживайте активность и отмечайте вклад." },
];

const people = [
  { initials: "Л", name: "Лера", state: "Говорит", color: "violet" },
  { initials: "М", name: "Макс", state: "В эфире", color: "coral" },
  { initials: "А", name: "Аня", state: "Слушает", color: "mint" },
  { initials: "И", name: "Илья", state: "Слушает", color: "amber" },
];

function Logo() {
  return <span className="fz-logo"><span><BrandMark size={24} /></span><strong>FlipZero</strong></span>;
}

function PrimaryDownload() {
  return <Link className="fz-button fz-button-primary" href="/download"><Download size={16} /> Скачать для Windows</Link>;
}

function ProductPreview() {
  return <div className="fz-product" aria-label="Предпросмотр интерфейса FlipZero">
    <div className="fz-product-bar"><span><i /><i /><i /></span><small>FlipZero — Команда продукта</small></div>
    <div className="fz-product-body">
      <aside className="fz-preview-rail"><b>F</b><i /><i /><i /></aside>
      <aside className="fz-preview-channels"><strong>Команда продукта</strong><small>ТЕКСТОВЫЕ КАНАЛЫ</small><span className="active"><Hash size={13} /> общий</span><span><Hash size={13} /> релизы</span><span><Hash size={13} /> вопросы</span><small>ГОЛОСОВЫЕ</small><span className="voice"><Mic2 size={13} /> Лаунж <em>4</em></span></aside>
      <section className="fz-preview-chat"><header><Hash size={16} /><b>общий</b><small>128 участников</small></header><article><i className="violet" /><p><b>Лера</b><span>Собираемся в голосовой в 19:00?</span></p></article><article><i className="coral" /><p><b>Макс</b><span>Да! Я заодно покажу новый экран.</span></p></article><article><i className="mint" /><p><b>Аня</b><span>Отлично, добавила событие в календарь ✨</span></p></article><footer>Написать в #общий <b>＋ ☺</b></footer></section>
    </div>
  </div>;
}

function VoiceCard() {
  return <div className="fz-voice-card"><header><span><small>ГОЛОСОВОЙ КАНАЛ</small><strong>Лаунж</strong></span><b>● 4 в сети</b></header><div className="fz-voice-grid">{people.map(person => <article key={person.name}><i className={person.color}>{person.initials}</i><strong>{person.name}</strong><small className={person.state === "Говорит" ? "talking" : ""}>{person.state}</small></article>)}</div><footer><span><Mic2 size={14} /> Микрофон</span><span><Video size={14} /> Камера</span><span><MonitorUp size={14} /> Экран</span></footer></div>;
}

export default function LandingPage() {
  return <main className="fz-landing">
    <header className="fz-header"><div className="fz-container fz-header-inner"><Link href="/" aria-label="FlipZero — главная"><Logo /></Link><nav aria-label="Главная навигация"><a href="#features">Возможности</a><a href="#voice">Голос и видео</a><a href="#communities">Сообщества</a><Link href="/download">Скачать</Link></nav><Link className="fz-header-button" href="/app">Открыть FlipZero</Link><details className="fz-mobile-menu"><summary aria-label="Открыть меню"><Menu size={20} /></summary><nav><a href="#features">Возможности</a><a href="#voice">Голос и видео</a><a href="#communities">Сообщества</a><Link href="/download">Скачать</Link><Link href="/app">Открыть FlipZero</Link></nav></details></div></header>

    <section className="fz-hero"><div className="fz-container"><span className="fz-eyebrow pill">● Новое пространство для общения</span><h1>Ваши люди. Ваше <em>место.</em></h1><p>Чаты, голос, видео и сообщества — в одном быстром и спокойном пространстве, которое принадлежит вам.</p><div className="fz-actions"><PrimaryDownload /><Link className="fz-button fz-button-secondary" href="/app">Открыть FlipZero</Link></div><small>Бесплатно, без карты, в браузере</small><ProductPreview /></div></section>

    <section className="fz-section" id="features"><div className="fz-container"><header className="fz-section-head"><span className="fz-eyebrow">ВОЗМОЖНОСТИ</span><h2>Общение без лишних<br />барьеров</h2><p>Всё необходимое для близких, команды и больших сообществ — понятно с первого сообщения.</p></header><div className="fz-feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><i><Icon size={20} /></i><h3>{title}</h3><p>{text}</p><a href="#voice">Подробнее <ArrowRight size={13} /></a></article>)}</div></div></section>

    <section className="fz-section fz-split" id="voice"><div className="fz-container"><div className="fz-copy"><span className="fz-eyebrow">ГОЛОС И ВИДЕО</span><h2>Будто вы в одной<br />комнате</h2><p>Мгновенно подключайтесь к друзьям и коллегам. Чистый звук, плавное видео и никаких сложных настроек.</p><ul><li><Check size={14} /> Камера</li><li><Check size={14} /> Демонстрация экрана</li><li><Check size={14} /> Выбор микрофона</li></ul></div><VoiceCard /></div></section>

    <section className="fz-section fz-communities" id="communities"><div className="fz-container"><header className="fz-section-head"><span className="fz-eyebrow">СООБЩЕСТВА</span><h2>Пространство, которое<br />растёт вместе с вами</h2><p>От уютного клуба до открытого сообщества — соберите всё важное в одном месте.</p></header><div className="fz-community-grid">{communityTools.map(({ icon: Icon, title, text }) => <article key={title}><i><Icon size={18} /></i><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

    <section className="fz-section fz-moderation"><div className="fz-container"><div className="fz-copy"><span className="fz-eyebrow">МОДЕРАЦИЯ</span><h2>Порядок без лишнего<br />контроля</h2><p>Назначайте роли и права, защищайте участников и задавайте понятные правила. Инструменты модерации работают тихо, пока сообщество живёт своей жизнью.</p><Link className="fz-button fz-button-primary" href="/app">Открыть своё пространство</Link></div><div className="fz-roles"><header><strong>Роли и доступ</strong><b><ShieldCheck size={12} /> Защищено</b></header><p><i className="mint" /> <span><strong>Администраторы</strong><small>8 участников</small></span><em>Все права</em></p><p><i className="violet" /> <span><strong>Модераторы</strong><small>24 участника</small></span><em>Управление чатами</em></p><p><i className="coral" /> <span><strong>Участники</strong><small>1 280 участников</small></span><em>Базовые права</em></p></div></div></section>

    <section className="fz-cta"><div className="fz-container"><h2>Ваше пространство уже ждёт</h2><p>Соберите своих людей и начните разговор в FlipZero уже сегодня.</p><div className="fz-actions"><PrimaryDownload /><Link className="fz-button fz-button-secondary" href="/app">Открыть FlipZero</Link></div></div></section>

    <footer className="fz-footer"><div className="fz-container"><section><Logo /><p>Чаты, голос, видео и сообщества в одном спокойном пространстве.</p><PrimaryDownload /><Link className="fz-footer-open" href="/app">Открыть FlipZero</Link></section><nav><strong>ПРОДУКТ</strong><a href="#features">Возможности</a><a href="#voice">Голос и видео</a><a href="#communities">Сообщества</a></nav><nav><strong>РЕСУРСЫ</strong><Link href="/api/health">Статус</Link><Link href="/download">Поддержка</Link><Link href="/privacy">Безопасность</Link></nav><nav><strong>НАЧАТЬ</strong><Link href="/download">Скачать</Link><Link href="/login">Войти</Link><Link href="/register">Создать сообщество</Link></nav><div className="fz-footer-bottom"><span>© 2026 FlipZero. Все права защищены.</span><span><Link href="/privacy">Конфиденциальность</Link> · <Link href="/terms">Условия</Link></span></div></div></footer>
  </main>;
}
