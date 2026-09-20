"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Database, LoaderCircle, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import styles from "./setup.module.css";

type Status = "idle" | "loading" | "success" | "error";

export default function ReleaseSetupPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function applyMigration() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/setup/release-0010", { method: "POST" });
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
      <section className={styles.card} aria-labelledby="setup-title">
        <div className={styles.brand}><span>FZ</span><strong>FlipZero</strong></div>
        <div className={styles.icon}>{isSuccess ? <CheckCircle2 size={31} /> : <ShieldCheck size={31} />}</div>
        <span className={styles.badge}><LockKeyhole size={14} /> Защищённая установка</span>
        <p className={styles.release}>RELEASE 0010</p>
        <h1 id="setup-title">Подготовка новых функций</h1>
        <p className={styles.description}>Обновление базы данных для SuperFlip, личных сообщений, друзей и административной панели.</p>

        <div className={styles.features}>
          <span><Database size={17} /> Новые таблицы</span>
          <span><Users size={17} /> Друзья и сообщения</span>
          <span><ShieldCheck size={17} /> Роль администратора</span>
        </div>

        {message && (
          <div className={`${styles.notice} ${isSuccess ? styles.success : styles.error}`} role="status">
            {isSuccess ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
            <span>{message}</span>
          </div>
        )}

        <button className={styles.action} type="button" onClick={applyMigration} disabled={isLoading || isSuccess}>
          {isLoading ? <LoaderCircle className={styles.spinner} size={19} /> : <Database size={19} />}
          {isLoading ? "Применяем миграцию…" : isSuccess ? "Миграция применена" : "Применить миграцию"}
        </button>
        <p className={styles.security}>Действие доступно только авторизованному аккаунту администратора.</p>
        <Link className={styles.back} href="/app"><ArrowLeft size={15} /> Вернуться в FlipZero</Link>
      </section>
    </main>
  );
}
