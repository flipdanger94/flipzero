import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Crown,
  Download,
  Gamepad2,
  Globe2,
  Hash,
  Monitor,
  Menu,
  MessageCircle,
  Mic2,
  Search,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const featureCards = [
  { icon: MessageCircle, title: "Чаты без ограничений", text: "Общайся в личных и групповых чатах, делись файлами и эмоциями." },
  { icon: Video, title: "Голос и видео", text: "Кристально чистый звук, стабильное соединение и быстрый вход в войс." },
  { icon: Users, title: "Твои сообщества", text: "Создавай пространства с гибкими настройками, ролями и каналами." },
  { icon: Gamepad2, title: "Игры и совместный досуг", text: "Будь ближе к тем, кто разделяет твои интересы." },
  { icon: ShieldCheck, title: "Безопасность", text: "Твои данные под защитой. Ты контролируешь своё пространство." },
  { icon: Code2, title: "Для разработчиков", text: "Создавай ботов, приложения и интеграции с нашим API." },
];

const members = [
  ["Dreamer", "Создаёт будущее", "DR"],
  ["Luna", "В сети", "LU"],
  ["Max", "В игре", "MX"],
  ["Sakura", "В сети", "SA"],
  ["Artem", "В сети", "AR"],
  ["pixel_kid", "В игре", "PK"],
];

function Logo() {
  return (
    <span className="fz-logo">
      <span className="fz-logo-mark"><BrandMark size={34} /></span>
      <span className="fz-logo-copy"><strong>FlipZero</strong><small>Больше, чем общение</small></span>
    </span>
  );
}

function HeroProduct() {
  return (
    <div className="fz-stage" aria-label="Интерфейс FlipZero">
      <div className="fz-stage-glow" />
      <section className="fz-app-preview">
        <aside className="fz-app-rail">
          <span className="fz-app-brand"><BrandMark size={24} /></span>
          {["+", "✦", "◉", "◆", "⬢", "◌"].map((item, index) => <i key={index}>{item}</i>)}
        </aside>

        <aside className="fz-app-sidebar">
          <div className="fz-server-title">
            <span><i>PC</i><strong>Pixel Craft</strong></span><small>12 436 участников</small>
          </div>
          <p>Главное</p>
          {["общий-чат", "анонсы", "мероприятия", "творчество", "мемы", "вопросы"].map((name, index) => (
            <span key={name} className={index === 0 ? "active" : ""}><Hash size={13} /> {name}</span>
          ))}
          <p>Голосовые каналы</p>
          {["Лаунж", "Игры", "Музыка", "Общение"].map((name, index) => (
            <span key={name}><Mic2 size={13} /> {name}{index === 0 ? <b>3 в эфире</b> : null}</span>
          ))}
          <div className="fz-app-user"><i>AL</i><span><strong>Alexander</strong><small>#1001</small></span><Mic2 size={13} /></div>
        </aside>

        <main className="fz-app-chat">
          <header><Hash size={18} /><strong>общий-чат</strong><span>Общайся • Делись • Создавай вместе</span><Search size={18} /><Users size={18} /></header>
          <div className="fz-app-feed">
            <article>
              <i className="avatar avatar-luna">LU</i>
              <div><p><strong>Luna 💜</strong><time>Сегодня, 14:28</time></p><span>Ребят, посмотрите на этот арт, который я сделала сегодня! ✨</span><div className="fz-art-card"><div className="fz-art-moon" /><div className="fz-art-city" /></div><footer><b>❤️ 284</b><b>🔥 42</b><b>⭐ 27</b></footer></div>
            </article>
            <article><i className="avatar avatar-max">MX</i><div><p><strong>Max</strong><time>Сегодня, 14:31</time></p><span>Выглядит потрясающе! 🔥<br />Можно добавить это в галерею пространства?</span></div></article>
            <article><i className="avatar avatar-sakura">SA</i><div><p><strong>Sakura 🌸</strong><time>Сегодня, 14:32</time></p><span>Да, конечно! Сейчас закину ещё пару вариантов 🙂</span></div></article>
          </div>
          <div className="fz-app-composer"><span>＋</span><p>Написать сообщение в #общий-чат...</p><b>GIF</b><b>☺</b><button>➤</button></div>
        </main>

        <aside className="fz-app-members">
          <header><strong>Участники — 1 245</strong><Search size={15} /></header>
          <small>ВЛАДЕЛЕЦ — 1</small>
          {members.map(([name, state, initials], index) => (
            <div key={name}><i className={"member-avatar m" + index}>{initials}</i><span><strong>{name}{index === 0 ? " 👑" : ""}</strong><small>{state}</small></span></div>
          ))}
        </aside>
      </section>
      <span className="fz-note fz-note-top"><Crown size={34} /> ТВОЁ<br />СООБЩЕСТВО<br />ТВОИ ПРАВИЛА</span>
      <span className="fz-note fz-note-left">Больше<br />чем общение ↗</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="fz-landing">
      <header className="fz-header">
        <div className="fz-container fz-header-inner">
          <Link href="/" aria-label="FlipZero — главная"><Logo /></Link>
          <nav aria-label="Главная навигация">
            <a href="#features">Возможности</a>
            <a href="#voice">Голос и видео</a>
            <a href="#communities">Сообщества</a>
            <Link href="/download">Скачать</Link>
            <Link className="fz-nav-super" href="/superflip"><Crown size={14} /> SUPER FLIP</Link>
            <Link href="/developers">Для разработчиков</Link>
          </nav>
          <div className="fz-locale"><Globe2 size={17} /><span>RU</span></div>
          <Link className="fz-header-button" href="/app">Открыть FlipZero</Link>
          <details className="fz-mobile-menu">
            <summary aria-label="Открыть меню"><Menu size={20} /></summary>
            <nav>
              <a href="#features">Возможности</a>
              <a href="#voice">Голос и видео</a>
              <a href="#communities">Сообщества</a>
              <Link href="/download">Скачать</Link>
              <Link className="fz-nav-super" href="/superflip"><Crown size={14} /> SUPER FLIP</Link>
              <Link href="/developers">Для разработчиков</Link>
              <Link href="/app">Открыть FlipZero</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className="fz-hero">
        <div className="fz-space-orb fz-orb-one" />
        <div className="fz-space-orb fz-orb-two" />
        <div className="fz-container fz-hero-grid">
          <div className="fz-hero-copy">
            <span className="fz-eyebrow pill"><i /> Место для твоего сообщества</span>
            <h1>Ваши люди.<br /><em>Ваше место.</em></h1>
            <p>Чаты, голос, видео и сообщества в одном месте. Создайте своё пространство и общайтесь с друзьями в браузере или приложении для Windows.</p>
            <div className="fz-actions">
              <Link className="fz-button fz-button-primary" href="/app">Открыть FlipZero <ArrowRight size={17} /></Link>
              <Link className="fz-button fz-button-secondary" href="/download"><Download size={18} /> Скачать для Windows</Link>
            </div>
            <small className="fz-free-note">Можно начать прямо в браузере</small>
            <div className="fz-platforms" aria-label="Доступные платформы">
              <span><Monitor size={22} aria-hidden="true" /><small>Windows</small></span>
                            <span><Globe2 size={22} aria-hidden="true" /><small>Веб-версия</small></span>
            </div>
          </div>
          <HeroProduct />
        </div>

        <div className="fz-container fz-feature-strip" id="features">
          {featureCards.map(({ icon: Icon, title, text }) => (
            <article key={title}><i><Icon size={23} /></i><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="fz-section fz-features-deep" id="voice">
        <div className="fz-container">
          <header className="fz-section-head">
            <span className="fz-eyebrow">ВОЗМОЖНОСТИ</span>
            <h2>Общение без лишних<br />барьеров</h2>
            <p>Всё необходимое для близких, команд и больших сообществ — понятно с первого сообщения.</p>
          </header>
          <div className="fz-deep-grid">
            <article><span className="fz-deep-number">01</span><MessageCircle size={28} /><span><h3>Сообщения, которые не мешают жить</h3><p>Личные и групповые чаты, файлы и общение в каналах — быстро и без лишнего шума.</p></span><div className="fz-deep-visual"><b># общий-чат</b><p><i /> Сообщение в канале</p><p className="mine"><i /> Ответ участника</p></div></article>
            <article><span className="fz-deep-number">02</span><Video size={28} /><span><h3>Голос и видео в один клик</h3><p>Заходи в голосовые каналы, включай видео и оставайся на связи.</p></span><div className="fz-deep-visual voice"><b>Голосовой канал</b><p><i /> Участник в эфире</p><p><i /> Участник подключён</p></div></article>
            <article id="communities"><span className="fz-deep-number">03</span><Users size={28} /><span><h3>Сообщества, которые принадлежат тебе</h3><p>Настраивай роли, категории и события в своём пространстве.</p></span><div className="fz-deep-visual community"><b>Pixel Craft</b><p># общий-чат</p><p># мероприятия</p></div></article>
          </div>
        </div>
      </section>

      <section className="fz-levels"><div className="fz-container"><span className="fz-eyebrow">ПРОГРЕСС</span><h2>Общайтесь и открывайте достижения</h2><p>Участвуйте в жизни сообщества, набирайте опыт и следите за своим уровнем в профиле.</p></div></section>

      <section className="fz-superflip" id="superflip">
        <div className="fz-container">
          <div className="fz-superflip-mark"><Crown size={34} /></div>
          <div><span className="fz-eyebrow">SUPER FLIP</span><h2>SUPER FLIP</h2><p>Раздел SuperFlip доступен внутри FlipZero. Настраивайте профиль и используйте дополнительные возможности общения. Подробности — на отдельной странице.</p></div>
          <Link className="fz-button fz-button-super" href="/superflip">Подробнее о SUPER FLIP <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="fz-cta">
        <div className="fz-container">
          <span className="fz-eyebrow">FLIPZERO</span>
          <h2>Собери своих людей<br />в одном месте</h2>
          <p>Создай пространство, позови друзей и начни общаться уже сейчас.</p>
          <div className="fz-actions"><Link className="fz-button fz-button-primary" href="/app">Открыть FlipZero</Link><Link className="fz-button fz-button-secondary" href="/register">Создать аккаунт</Link></div>
        </div>
      </section>

      <footer className="fz-footer">
        <div className="fz-container">
          <div className="fz-footer-main">
            <div className="fz-footer-brand">
              <Link href="/" aria-label="FlipZero — главная"><Logo /></Link>
              <p>Чаты, голос, видео и сообщества в одном пространстве — без лишних барьеров.</p>
              <Link className="fz-footer-app-link" href="/app">Открыть FlipZero <ArrowRight size={15} /></Link>
            </div>

            <nav className="fz-footer-column" aria-label="Продукт">
              <strong>Продукт</strong>
              <a href="#features">Возможности</a>
              <a href="#voice">Голос и видео</a>
              <a href="#communities">Сообщества</a>
              <Link href="/superflip">SUPER FLIP</Link>
            </nav>

            <nav className="fz-footer-column" aria-label="Ресурсы">
              <strong>Ресурсы</strong>
              <Link href="/download">Скачать</Link>
              <Link href="/developers">Для разработчиков</Link>
              <Link href="/login">Войти</Link>
              <Link href="/register">Создать аккаунт</Link>
            </nav>

            <nav className="fz-footer-column" aria-label="Документы">
              <strong>Документы</strong>
              <Link href="/privacy">Конфиденциальность</Link>
              <Link href="/terms">Условия использования</Link>
            </nav>
          </div>

          <div className="fz-footer-bottom">
            <span>© 2026 FlipZero. Больше, чем общение.</span>
            <span className="fz-footer-status"><i /> Сервис работает</span>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "FlipZero",
          url: "https://flipzeroapp.vercel.app/",
          applicationCategory: "CommunicationApplication",
          operatingSystem: "Windows, macOS, Linux, Android, Web",
          description: "Платформа для чатов, голосовой и видеосвязи и сообществ."
        }) }}
      />
    </main>
  );
}
