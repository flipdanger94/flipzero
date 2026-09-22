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
  Video,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import BillingToggle from "./billing-toggle";
import styles from "./superflip.module.css";

export const metadata: Metadata = {
  title: "SUPER FLIP",
  description: "Черновая страница тарифа SUPER FLIP с расширенными возможностями FlipZero.",
  alternates: { canonical: "/superflip" },
  openGraph: {
    title: "SUPER FLIP | FlipZero",
    description: "Расширенные возможности FlipZero для общения, профиля и сообществ.",
    url: "/superflip",
  },
};

const perks = [
  {
    icon: Sticker,
    title: "Твои эмодзи — везде",
    text: "Кастомные эмодзи и стикеры из своих сообществ доступны во всех чатах и сообществах.",
  },
  {
    icon: UserRound,
    title: "Профиль, который выделяется",
    text: "Анимированный аватар и баннер, бейдж SUPER FLIP, 4-значный тег и отдельный профиль под каждое сообщество.",
  },
  {
    icon: Video,
    title: "Стрим в 1440p при 60 FPS",
    text: "До 1440p / 60 FPS в SUPER FLIP против 720p / 30 FPS на бесплатном тарифе.",
  },
  {
    icon: FileUp,
    title: "Файлы до 500 МБ",
    text: "До 500 МБ на один файл в SUPER FLIP против 25 МБ на Free.",
  },
  {
    icon: Palette,
    title: "Кастомные темы",
    text: "Персонализация интерфейса FlipZero через дополнительные темы приложения.",
  },
];

const comparison = [
  ["4-значный тег после юзернейма", "Недоступно", "Доступно"],
  ["Отдельный профиль под каждое сообщество", "Недоступно", "Доступно"],
  ["Бейдж подписчика SUPER FLIP", "Недоступно", "Доступно"],
  ["Анимированный аватар и баннер", "Недоступно", "Доступно"],
  ["Кастомные эмодзи/стикеры в любом сообществе", "Недоступно", "Доступно"],
  ["Качество войса / демонстрации экрана", "до 720p / 30 FPS", "до 1440p / 60 FPS"],
  ["Максимальный размер загружаемого файла", "25 МБ", "500 МБ"],
  ["Символов в одном сообщении", "2 000", "4 000"],
  ["Количество сообществ для участия", "100", "200"],
  ["Сохранённые фоны для видеозвонков", "1", "15"],
  ["Сообщений в закладках", "50", "300"],
  ["Ранний доступ к новым функциям", "Недоступно", "Доступно"],
  ["Кастомные темы приложения", "Недоступно", "Доступно"],
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
            <span className={styles.draftBadge}><Sparkles size={15} /> Черновой тариф</span>
            <div className={styles.crownOrb}><Crown size={48} /></div>
            <p className={styles.kicker}>FLIPZERO PREMIUM</p>
            <h1>FlipZero <em>SUPER FLIP</em></h1>
            <p className={styles.lead}>
              Расширенные возможности для общения, персонализации и сообществ в FlipZero.
            </p>

            <BillingToggle />

            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/app">
                <Crown size={18} /> Оформить SUPER FLIP <ArrowRight size={17} />
              </Link>
              <a className={styles.supportLink} href="#support">Просто хотите поддержать проект? Задонать</a>
            </div>

            <p className={styles.disclaimer}>
              Цена и лимиты на этой странице пока являются черновыми и должны быть подтверждены перед запуском.
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
              <p>@username <span>#0001</span></p>
              <div className={styles.badgeRow}>
                <b><Crown size={13} /> SUPER FLIP</b>
                <b><ShieldCheck size={13} /> Профиль</b>
              </div>
              <div className={styles.profileStats}>
                <span><ImageIcon size={18} /><small>Анимированный<br />баннер</small></span>
                <span><Palette size={18} /><small>Кастомная<br />тема</small></span>
                <span><Sticker size={18} /><small>Эмодзи<br />везде</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefits} id="benefits">
        <div className={styles.sectionHeader}>
          <span>КЛЮЧЕВЫЕ ПРЕИМУЩЕСТВА</span>
          <h2>Больше возможностей.<br />Больше твоего стиля.</h2>
          <p>Пять ключевых направлений SUPER FLIP из текущего чернового тарифа.</p>
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
          <p>Точные значения ниже взяты из текущего черновика тарифа и требуют финального утверждения перед запуском.</p>
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
            Оформить SUPER FLIP <ArrowRight size={17} />
          </Link>
          <small>Тариф, цена и лимиты пока находятся на этапе согласования.</small>
        </div>
      </section>
    </main>
  );
}
