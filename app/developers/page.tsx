import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Braces, Boxes, Code2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Для разработчиков",
  description: "Инструменты FlipZero для создания ботов, приложений и интеграций через API.",
  alternates: { canonical: "/developers" },
  openGraph: { url: "/developers", title: "Для разработчиков | FlipZero", images: ["/opengraph-image"] },
};

export default function DevelopersPage() {
  return (
    <main className="developer-public-page">
      <header>
        <Link href="/" aria-label="FlipZero — главная"><BrandMark size={34} /><strong>FlipZero</strong></Link>
        <Link href="/app">Открыть FlipZero <ArrowRight size={16} /></Link>
      </header>
      <section>
        <span><Code2 size={18} /> ДЛЯ РАЗРАБОТЧИКОВ</span>
        <h1>Создавайте для FlipZero</h1>
        <p>Начни с ключа в консоли разработчика. Сейчас доступны чтение профиля и списка твоих пространств, установка ботов, webhooks и OAuth.</p>
        <div>
          <article><Bot size={24} /><h2>Боты</h2><p>Создавайте ботов для взаимодействия с FlipZero.</p></article>
          <article><Boxes size={24} /><h2>Приложения</h2><p>Подключайте приложения к платформе FlipZero.</p></article>
          <article><Braces size={24} /><h2>Интеграции</h2><p>Связывайте FlipZero с внешними сервисами через API.</p></article>
        </div>
        <div className="developer-public-actions"><Link className="developer-public-cta" href="/developers/console">Создать приложение или API-ключ <ArrowRight size={17} /></Link><Link className="developer-public-docs" href="/developers/docs">Читать документацию</Link></div>
        <p>Запрос к API: <code>GET /api/public/v1/me</code> с заголовком <code>Authorization: Bearer &lt;token&gt;</code>. Права ключа: <code>profile:read</code> и <code>spaces:read</code>. Лимиты и доступность дополнительных методов уточняй в <Link href="/developers/docs">документации</Link>.</p>
      </section>
    </main>
  );
}
