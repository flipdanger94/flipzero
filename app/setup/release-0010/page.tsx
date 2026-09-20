"use client";
import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldCheck } from "lucide-react";

export default function ReleaseSetupPage() {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [done, setDone] = useState(false);
  async function apply() { setBusy(true); const response = await fetch("/api/setup/release-0010", { method: "POST" }); const result = await response.json(); setMessage(result.message); setDone(response.ok); setBusy(false); }
  return <main className="download-page"><section className="download-card"><span className="download-badge"><ShieldCheck size={15} /> &nbsp;Защищённая установка</span><h1>Release 0010</h1><p>Применение таблиц SuperFlip, личных сообщений, друзей и административной роли. Доступ разрешён только аккаунту из серверной переменной ADMIN_EMAIL.</p><button className="download-action" onClick={apply} disabled={busy || done}>{busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} &nbsp;{done ? "Установка завершена" : "Применить миграцию"}</button>{message ? <div className="download-requirements">{message}</div> : null}<Link className="download-home" href="/app">Вернуться в FlipZero</Link></section></main>;
}
