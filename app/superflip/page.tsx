import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import styles from "./superflip.module.css";

export const metadata: Metadata = {
  title: "SuperFlip",
  description: "SuperFlip — подписка FlipZero с расширенной персонализацией, лимитами и бонусами.",
  alternates: { canonical: "/superflip" },
  openGraph: {
    title: "SuperFlip | FlipZero",
    description: "Больше возможностей, больше персонализации и бонусов в FlipZero.",
    url: "/superflip",
  },
};

const whatsNew: Array<{icon:AppIconName;eyebrow:string;title:string;text:string;art:string}> = [
  { icon: "gift", eyebrow: "ORB BONUS", title: "Больше Orbs за активность", text: "Квесты с активным SuperFlip дают на 20% больше XP и Orbs — коллекция косметики растёт быстрее.", art: "orbs" },
  { icon: "user", eyebrow: "PROFILE", title: "Живой профиль", text: "Анимированные медиа, больше места для описания и косметика из магазина работают вместе.", art: "profile" },
  { icon: "appearance", eyebrow: "STYLE", title: "Эксклюзивные предметы", text: "Часть анимированных рамок, эффектов и наборов в магазине открывается только с SuperFlip.", art: "style" },
];

const benefits: Array<{icon:AppIconName;title:string;text:string}> = [
  { icon: "user", title: "Профиль до 500 символов", text: "Больше места для описания, статуса и собственной подачи." },
  { icon: "upload", title: "Больше медиа", text: "Аватар до 8 МБ, баннер до 16 МБ и анимированные изображения." },
  { icon: "messages", title: "Сообщения до 4000", text: "Длинные личные сообщения вместо базового лимита 1000 символов." },
  { icon: "gift", title: "+20% к наградам", text: "Больше XP и Orbs за выполненные задания и серии активности." },
  { icon: "equip", title: "5 бейджей в профиле", text: "Расширенная витрина наград и достижений." },
  { icon: "superflip", title: "SuperUp пространства", text: "Поддержка одного пространства и дополнительный вклад в его развитие." },
];

const comparison = [
  ["Описание профиля", "190 символов", "500 символов"],
  ["Аватар", "2 МБ", "8 МБ"],
  ["Баннер", "4 МБ", "16 МБ"],
  ["Личное сообщение", "1000 символов", "4000 символов"],
  ["Награды за квесты", "Базовые", "+20% XP и Orbs"],
  ["Бейджи в профиле", "3", "5"],
  ["Анимированные медиа", "—", "Доступно"],
  ["Эксклюзивная косметика", "Часть каталога", "Расширенный каталог"],
];

export default function SuperFlipPage() {
  return (
    <main className={styles.page} data-theme="superflip">
      <header className={styles.topbar}>
        <Link href="/" className={styles.logo} aria-label="FlipZero — главная"><BrandMark size={31}/><span>FlipZero</span></Link>
        <nav aria-label="Навигация SuperFlip">
          <a href="#home">Главная</a><a href="#new">Что нового</a><a href="#benefits">Лучшие бонусы</a><a href="#plans">Тарифы</a><a href="#compare">Сравнить</a>
        </nav>
        <Link href="/app" className={styles.giftButton}><AppIcon name="gift" size={16}/>Открыть FlipZero</Link>
      </header>

      <section className={styles.hero} id="home">
        <div className={styles.heroGlow}/>
        <div className={styles.heroContent}>
          <span className={styles.pill}><AppIcon name="animated" size={14}/> SUPERFLIP</span>
          <h1>Откройте больше<br/><em>возможностей FlipZero</em></h1>
          <p>Персонализация, увеличенные лимиты, дополнительные награды и особые предметы магазина — в одном уровне.</p>
          <div className={styles.heroActions}>
            <Link href="/app" className={styles.primary}>Открыть лист ожидания <AppIcon name="forward" size={17}/></Link>
            <a href="#benefits" className={styles.secondary}>Посмотреть бонусы</a>
          </div>
          <small>Покупка ещё не запущена. Сейчас доступ выдаётся приглашением или администратором.</small>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.heroOrb}><AppIcon name="superflip" size={92}/><span>SUPER</span></div>
          <div className={styles.floatStarA}>✦</div><div className={styles.floatStarB}>✦</div>
          <div className={styles.floatCard}><div className={styles.fakeBanner}/><div className={styles.fakeAvatar}>FZ</div><strong>Ваш профиль</strong><span>+ анимированный стиль</span></div>
        </div>
      </section>

      <section className={styles.section} id="new">
        <div className={styles.sectionTitle}><span>ЧТО НОВОГО</span><h2>SuperFlip становится частью вашего стиля</h2><p>Бонусы связаны с профилем, магазином и ежедневной активностью, а не живут отдельным экраном.</p></div>
        <div className={styles.newsGrid}>
          {whatsNew.map(({icon,eyebrow,title,text,art})=><article key={title} className={styles.newsCard}>
            <div className={styles.newsArt+" "+styles[art]}><AppIcon name={icon} size={42}/><i/><i/><i/></div>
            <small>{eyebrow}</small><h3>{title}</h3><p>{text}</p>
          </article>)}
        </div>
      </section>

      <section className={styles.section} id="benefits">
        <div className={styles.sectionTitle}><span>ЛУЧШИЕ БОНУСЫ SUPERFLIP</span><h2>Больше свободы внутри FlipZero</h2><p>Аккуратные улучшения поверх привычного интерфейса: без отдельного премиум-приложения и без разрыва основных сценариев.</p></div>
        <div className={styles.benefitGrid}>{benefits.map(({icon,title,text})=><article key={title}><span><AppIcon name={icon} size={23}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className={styles.plans} id="plans">
        <div className={styles.sectionTitle}><span>ВЫБЕРИТЕ ТАРИФ</span><h2>Просто и прозрачно</h2><p>Платёжная система ещё не подключена, поэтому кнопка ведёт в текущий waitlist/status flow, а не на вымышленный checkout.</p></div>
        <div className={styles.planGrid}>
          <article className={styles.freePlan}><small>FLIPZERO FREE</small><h3>Базовый</h3><strong>$0</strong><p>Все основные чаты, голос, сообщества и базовая персонализация.</p><ul><li><AppIcon name="equip" size={15}/>Основные функции FlipZero</li><li><AppIcon name="equip" size={15}/>Базовые лимиты профиля</li><li><AppIcon name="equip" size={15}/>Магазин и инвентарь</li></ul><Link href="/app">Открыть FlipZero</Link></article>
          <article className={styles.premiumPlan}><div className={styles.recommended}><AppIcon name="superflip" size={13}/>SUPERFLIP</div><small>ОЖИДАЕМАЯ ЦЕНА</small><h3>SuperFlip</h3><strong>$4.99 <em>/ месяц</em></strong><p>Все возможности Free плюс расширенная персонализация, награды и эксклюзивы.</p><ul><li><AppIcon name="equip" size={15}/>+20% XP и Orbs</li><li><AppIcon name="equip" size={15}/>Анимированные медиа</li><li><AppIcon name="equip" size={15}/>Эксклюзивная косметика</li></ul><Link href="/app">В лист ожидания <AppIcon name="forward" size={15}/></Link></article>
        </div>
      </section>

      <section className={styles.compare} id="compare">
        <div className={styles.sectionTitle}><span>СРАВНИТЬ</span><h2>Free и SuperFlip</h2></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Возможность</th><th>Free</th><th><AppIcon name="superflip" size={15}/> SuperFlip</th></tr></thead><tbody>{comparison.map(([label,free,premium])=><tr key={label}><th>{label}</th><td>{free}</td><td>{premium}</td></tr>)}</tbody></table></div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalArt}><AppIcon name="animated" size={46}/><AppIcon name="gift" size={28}/><AppIcon name="animated" size={34}/></div>
        <span>SUPERFLIP</span><h2>Готовы открыть больше?</h2><p>Перейдите в FlipZero и присоединитесь к листу ожидания.</p>
        <Link href="/app">Открыть SuperFlip <AppIcon name="forward" size={17}/></Link>
      </section>

      <div className={styles.stickyCta}><div><AppIcon name="superflip" size={17}/><span><strong>SuperFlip</strong><small>лист ожидания открыт</small></span></div><Link href="/app">Подключить <AppIcon name="forward" size={15}/></Link></div>
    </main>
  );
}
