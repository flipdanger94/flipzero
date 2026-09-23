"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Database, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import styles from "../release-0010/setup.module.css";

type Status = "idle" | "loading" | "success" | "error";

const releases: Record<string, { number: string; title: string; description: string }> = {
  "release-0000": { number: "0000", title: "Phase Zero", description: "Базовая схема пользователей, пространств, каналов, сообщений и модерации." },
  "release-0001": { number: "0001", title: "Категории каналов", description: "Создаёт категории каналов и связь каналов с категориями." },
  "release-0002": { number: "0002", title: "Геймификация", description: "Добавляет прогресс, достижения и косметические настройки профиля." },
  "release-0003": { number: "0003", title: "Messaging", description: "Добавляет треды, закрепления и настройки уведомлений каналов." },
  "release-0004": { number: "0004", title: "Форматы каналов", description: "Добавляет данные для board-каналов и расширенных форматов." },
  "release-0005": { number: "0005", title: "События сообщества", description: "Создаёт события сообщества и список участников событий." },
  "release-0006": { number: "0006", title: "Wiki", description: "Создаёт Wiki-страницы и историю их изменений." },
  "release-0007": { number: "0007", title: "Developer Platform", description: "Создаёт приложения разработчиков и API-токены." },
  "release-0008": { number: "0008", title: "Trust & Safety", description: "Создаёт модерационные флаги для проверки контента." },
  "release-0009": { number: "0009", title: "Space placements", description: "Создаёт размещение пространств по шардам и регионам." },
  "release-0013": { number: "0013", title: "Профили пользователей", description: "Добавляет локацию, пользовательский статус и ссылки профиля." },
  "release-0014": { number: "0014", title: "Voice states", description: "Создаёт состояния участников в голосовых комнатах." },
  "release-0015": { number: "0015", title: "Developer integrations", description: "Добавляет установки приложений, OAuth, API-токены и Webhooks." },
  "release-0016": { number: "0016", title: "Роли участников", description: "Позволяет показывать выбранные роли справа от имени участника." },
  "release-0017": { number: "0017", title: "Восстановление пароля", description: "Добавляет одноразовые ссылки сброса пароля и ограничения частоты запросов." },
};

export default function DynamicReleaseSetupPage() {
  const params = useParams<{ release: string }>();
  const release = params.release;
  const config = releases[release];
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  if (!config) {
    return <main className={styles.page}><section className={styles.card}><div className={styles.icon}><ShieldCheck size={31}/></div><h1>Миграция не найдена</h1><p className={styles.description}>Такого release нет в разрешённом списке.</p><Link className={styles.back} href="/setup"><ArrowLeft size={15}/> К списку миграций</Link></section></main>;
  }

  async function applyMigration() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/setup/${release}`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? "Сервер не вернул описание результата.");
      setStatus(response.ok ? "success" : "error");
    } catch {
      setMessage("Не удалось связаться с сервером. Обновите страницу и попробуйте снова.");
      setStatus("error");
    }
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.brand}><span>FZ</span><strong>FlipZero</strong></div>
        <div className={styles.icon}>{isSuccess ? <CheckCircle2 size={31}/> : <ShieldCheck size={31}/>}</div>
        <span className={styles.badge}><LockKeyhole size={14}/> Защищённая установка</span>
        <p className={styles.release}>RELEASE {config.number}</p>
        <h1>{config.title}</h1>
        <p className={styles.description}>{config.description}</p>
        {message ? <div className={`${styles.notice} ${isSuccess ? styles.success : styles.error}`} role="status">{isSuccess ? <CheckCircle2 size={18}/> : <ShieldCheck size={18}/>}<span>{message}</span></div> : null}
        <button className={styles.action} type="button" onClick={() => void applyMigration()} disabled={isLoading || isSuccess}>
          {isLoading ? <LoaderCircle className={styles.spinner} size={19}/> : <Database size={19}/>}
          {isLoading ? "Применяем миграцию…" : isSuccess ? "Миграция применена" : "Применить миграцию"}
        </button>
        <p className={styles.security}>Действие доступно только авторизованному аккаунту администратора.</p>
        <Link className={styles.back} href="/setup"><ArrowLeft size={15}/> К списку миграций</Link>
      </section>
    </main>
  );
}
