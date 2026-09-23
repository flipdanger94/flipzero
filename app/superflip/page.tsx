import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Crown,
  FileUp,
  Gamepad2,
  Image as ImageIcon,
  Palette,
  ShieldCheck,
  Sparkles,
  Sticker,
  UserRound,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import styles from "./superflip.module.css";

export const metadata: Metadata = {
  title: "SUPER FLIP",
  description: "Возможности SuperFlip в FlipZero и запись в лист ожидания.",
  alternates: { canonical: "/superflip" },
  openGraph: {
    title: "SUPER FLIP | FlipZero",
    description: "Расширенные возможности FlipZero для общения, профиля и сообществ.",
    url: "/superflip",
  },
};

const perks = [
  { icon: UserRound, title: "Больше места в профиле", text: "Описание профиля до 500 символов вместо 190." },
  { icon: FileUp, title: "Медиа профиля", text: "Аватар до 8 МБ и баннер до 16 МБ; поддерживаются анимированные изображения." },
  { icon: Sparkles, title: "Длинные сообщения", text: "До 8000 символов в личном сообщении вместо 4000." },
  { icon: BadgeCheck, title: "Статус SuperFlip", text: "Активный доступ отображается в настройках аккаунта." },
  { icon: Crown, title: "Поддержка SuperUp", text: "Поддержите одно пространство; его уровень зависит от количества участников с активным SuperFlip." },
];
const comparison = [
  ["Описание профиля", "190 символов", "500 символов"],
  ["Аватар", "2 МБ", "8 МБ"],
  ["Баннер профиля", "4 МБ", "16 МБ"],
  ["Личное сообщение", "4000 символов", "8000 символов"],
  ["Анимированные медиа профиля", "Недоступно", "Доступно"],
  ["Поддержка пространства SuperUp", "Недоступно", "Одно пространство"],
];

function Availability({ value, premium = false }: { value: string; premium?: boolean }) {
  const yes = value === "Доступно";
  const no = value === "Недоступно";
  return (
    <span className={premium ? styles.premiumValue : undefined}>
      {yes ? <BadgeCheck size={17} aria-hidden="true" /> : null}
      {no ? <span className={styles.noIcon}>×</span> : null}
      {value}
    </span>
  );
}

export default function SuperFlipPage() {
  return (
    <main className={styles.page}>
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="FlipZero — главная">
            <BrandMark size={34} />
            <span><strong>FlipZero</strong><small>SUPER FLIP</small></span>
          </Link>

          <nav aria-label="Навигация SUPER FLIP">
            <a href="#benefits">Преимущества</a>
            <a href="#compare">Free vs SUPER FLIP</a>
            <Link href="/app">Открыть FlipZero</Link>
          </nav>

          <Link className={styles.backLink} href="/">
            <ArrowLeft size={16} /> На главную
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.draftBadge}><Sparkles size={15} /> Доступ по приглашению</span>
            <div className={styles.crownOrb}><Crown size={48} /></div>
            <p className={styles.kicker}>FLIPZERO PREMIUM</p>
            <h1>FlipZero <em>SUPER FLIP</em></h1>
            <p className={styles.lead}>
              Расширенные возможности для общения, персонализации и сообществ в FlipZero.
            </p>

            <p className={styles.disclaimer}>Покупка ещё не запущена. Запишитесь в лист ожидания в приложении.</p>

            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/app">
                <Crown size={18} /> Открыть лист ожидания <ArrowRight size={17} />
              </Link>
              <a className={styles.supportLink} href="#support">Просто хотите поддержать проект? Задонать</a>
            </div>

            <p className={styles.disclaimer}>
              Действующий доступ выдают администраторы; оплата и стоимость пока не объявлены.
            </p>
          </div>

          <div className={styles.premiumPreview} aria-label="Превью возможностей SUPER FLIP">
            <div className={styles.previewGlow} />
            <div className={styles.profileCard}>
              <div className={styles.profileBanner}>
                <span>SUPER FLIP</span>
                <Sparkles size={20} />
              </div>
              <div className={styles.avatarWrap}>
                <div className={styles.avatar}>FZ</div>
                <span className={styles.crownMini}><Crown size={14} /></span>
              </div>
              <h2>Ваш профиль</h2>
              <p>@username</p>
              <div className={styles.badgeRow}>
                <b><Crown size={13} /> SUPER FLIP</b>
                <b><ShieldCheck size={13} /> Профиль</b>
              </div>
              <div className={styles.profileStats}>
                <span><ImageIcon size={18} /><small>Анимированный<br />баннер</small></span>
                <span><Palette size={18} /><small>Больше<br />медиа</small></span>
                <span><Sticker size={18} /><small>Сообщения<br />8000</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefits} id="benefits">
        <div className={styles.sectionHeader}>
          <span>КЛЮЧЕВЫЕ ПРЕИМУЩЕСТВА</span>
          <h2>Больше возможностей.<br />Больше твоего стиля.</h2>
          <p>Возможности, которые уже доступны при активном SuperFlip.</p>
        </div>

        <div className={styles.perkGrid}>
          {perks.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className={styles.perkCard}>
              <span className={styles.perkIndex}>0{index + 1}</span>
              <i><Icon size={25} /></i>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.compareSection} id="compare">
        <div className={styles.sectionHeader}>
          <span>СРАВНЕНИЕ</span>
          <h2>Free или SUPER FLIP?</h2>
          <p>Сравнение действующих лимитов профиля и сообщений.</p>
        </div>

        <div className={styles.tableShell}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th>Возможность</th>
                <th>Free</th>
                <th className={styles.premiumHead}><Crown size={17} /> SUPER FLIP</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(([label, free, premium]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td><Availability value={free} /></td>
                  <td className={styles.premiumCell}><Availability premium value={premium} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.support} id="support">
        <div className={styles.supportCard}>
          <Gamepad2 size={28} />
          <div>
            <span>ПОДДЕРЖКА ПРОЕКТА</span>
            <h2>Хотите просто поддержать FlipZero?</h2>
            <p>
              Механика отдельного доната пока не настроена. Этот блок оставлен как часть концепта и не ведёт на вымышленную платёжную страницу.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span><Crown size={18} /> SUPER FLIP</span>
          <h2>Больше от FlipZero.<br />В одном уровне.</h2>
          <p>Перейдите в приложение, чтобы открыть раздел SUPER FLIP.</p>
          <Link className={styles.primaryButton} href="/app">
            Открыть лист ожидания <ArrowRight size={17} />
          </Link>
          <small>Покупка пока не открыта; запишитесь в лист ожидания.</small>
        </div>
      </section>
    </main>
  );
}
