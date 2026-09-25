import Link from "next/link";
import { ArrowLeft, ChevronRight, Database, ShieldCheck } from "lucide-react";
import styles from "./setup-index.module.css";

const releases = [
  ["0000", "Phase Zero", "Базовая схема пользователей, пространств, каналов и сообщений", "0000_phase_zero.sql"],
  ["0001", "Категории каналов", "Категории и привязка каналов к категориям", "0001_channel_categories.sql"],
  ["0002", "Геймификация", "Прогресс, достижения и косметика профиля", "0002_gamification.sql"],
  ["0003", "Messaging", "Треды, закрепления и настройки уведомлений каналов", "0003_messaging.sql"],
  ["0004", "Форматы каналов", "Доски и дополнительные форматы каналов", "0004_channel_formats.sql"],
  ["0005", "События сообщества", "События и участники событий", "0005_community_events.sql"],
  ["0006", "Wiki", "Wiki-страницы и история ревизий", "0006_wiki.sql"],
  ["0007", "Developer Platform", "Приложения разработчиков и API-токены", "0007_developer_platform.sql"],
  ["0008", "Trust & Safety", "Модерационные флаги и проверка контента", "0008_trust_safety.sql"],
  ["0009", "Space placements", "Размещение пространств по шардам и регионам", "0009_space_placements.sql"],
  ["0010", "SuperFlip / Social / Admin", "SuperFlip, друзья, личные сообщения и админ-функции", "0010_superflip_social_admin.sql"],
  ["0011", "Onboarding & Security", "Онбординг, 2FA и история входов", "0011_onboarding_security.sql"],
  ["0012", "Safety / Privacy / Notifications", "Жалобы, блокировки, приватность и уведомления", "0012_safety_privacy_notifications.sql"],
  ["0013", "Профили пользователей", "Локация, статус и ссылки профиля", "0012_user_profiles.sql"],
  ["0014", "Voice states", "Состояния участников в голосовых комнатах", "0013_voice_states.sql"],
  ["0015", "Developer integrations", "Bot installs, OAuth Authorization Code, API tokens и Webhooks", "0014_developer_integrations.sql"],
  ["0016", "Роли участников", "Показ выбранных ролей рядом с участниками пространства", "0015_role_member_badges.sql"],
  ["0017", "Восстановление пароля", "Одноразовые ссылки и ограничения запросов", "0016_password_reset.sql"],
  ["0018", "Поддержка SuperUp", "Распределение поддержки пространств", "0017_superup.sql"],
  ["0019", "Звуковая панель", "Звуковые клипы пространства", "0018_soundboard.sql"],
  ["0020", "Кланы", "Кланы, участники, заявки, сообщения и базовая клановая модель", "0019_clans.sql"],
  ["0021", "Прогресс кланов", "XP-вклад участников и прогресс кланов", "0020_clan_progress.sql"],
  ["0022", "История XP кланов", "Backfill истории и служебные данные кланового XP", "0021_clan_xp_backfill.sql"],
  ["0023", "Экономика и магазин", "Кошельки, транзакции и магазин", "0022_economy.sql"],
  ["0024", "Клановые сезоны и казна", "Сезоны, события, казна и governance кланов", "0023_clan_governance.sql"],
  ["0025", "Профили и истории", "Социальные профили, stories и связанные сущности", "0024_social_world.sql"],
  ["0026", "Темы и тихие часы", "Пользовательские настройки, темы и DND", "0025_personalization.sql"],
  ["0027", "Очистка временного voice", "Удаление устаревших временных голосовых комнат и приглашений", "0026_remove_temporary_voice.sql"],
  ["0028", "Voice speaking", "Флаг speaking для состояния участников голосовых комнат", "0027_voice_speaking.sql"],
  ["0029", "Лимит voice-канала", "Лимит участников голосового канала", "0028_voice_channel_user_limit.sql"],
  ["0030", "LiveKit voice webhooks", "Webhook-события LiveKit, breakout и heartbeat для voice presence", "0029_livekit_voice_webhooks.sql"],
  ["0031", "XP ledger", "Новый user_progress, дедупликация XP и безопасный backfill legacy XP", "0030_user_progress_ledger.sql"],
  ["0032", "Пользовательские темы", "Таблица управляемых тем приложения", "0031_custom_themes.sql"],
  ["0033", "Сессии личных звонков", "Жизненный цикл входящих и исходящих direct calls", "0032_direct_call_sessions.sql"],

] as const;

export default function SetupIndexPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}><span>FZ</span><strong>FlipZero</strong></div>
          <div className={styles.icon}><Database size={26} /></div>
          <p className={styles.eyebrow}><ShieldCheck size={14} /> Database setup</p>
          <h1>Миграции FlipZero</h1>
          <p className={styles.lead}>Защищённая панель ручного применения миграций production-базы. Выполнение доступно только администратору.</p>
        </header>

        <div className={styles.list}>
          {releases.map(([release, title, description, file]) => (
            <Link key={release} href={`/setup/release-${release}`} className={styles.item}>
              <div className={styles.number}>{release}</div>
              <div className={styles.info}>
                <strong>{title}</strong>
                <span>{description}</span>
                <code>{file}</code>
              </div>
              <ChevronRight size={19} />
            </Link>
          ))}
        </div>

        <p className={styles.note}>URL 0013 и 0014 исправляют старый конфликт нумерации: исходные SQL-файлы остаются без переименования, чтобы не ломать историю проекта.</p>
        <Link className={styles.back} href="/app"><ArrowLeft size={15} /> Вернуться в FlipZero</Link>
      </section>
    </main>
  );
}
