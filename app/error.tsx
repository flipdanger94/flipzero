"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="legal-page" role="alert"><article><Link href="/">← FlipZero</Link><h1>Не удалось открыть страницу</h1><p>Попробуй обновить её. Если ошибка повторится, вернись на главную.</p><button className="page-state-action" onClick={() => reset()}>Попробовать снова</button></article></main>;
}
