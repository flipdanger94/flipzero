import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, Code2, KeyRound, ShieldCheck, Webhook } from "lucide-react";

export const metadata: Metadata = {
  title: "Документация API для разработчиков",
  description: "Быстрый старт API FlipZero: создание приложения, Bearer-токен, права доступа и установка в пространство.",
  alternates: { canonical: "/developers/docs" },
};

const base = "https://flipzeroapp.vercel.app";

export default function DeveloperDocsPage() {
  return <main className="developer-docs-page"><div className="developer-docs-shell">
    <header><Link href="/developers"><ArrowLeft size={16} /> Разработчикам</Link><span>FlipZero / API</span><Link href="/developers/console">Открыть консоль <ArrowRight size={16} /></Link></header>
    <div className="developer-docs-grid"><nav aria-label="Разделы документации"><strong>Документация</strong><a href="#start">Быстрый старт</a><a href="#token">API-ключ и права</a><a href="#requests">Запросы к API</a><a href="#install">Установка в пространство</a><a href="#webhooks">События и OAuth</a></nav>
      <article>
        <div className="developer-docs-hero"><span><Code2 size={16} /> API FLIPZERO</span><h1>Первый запрос за несколько минут</h1><p>Создайте приложение, выпустите ключ и получите данные через публичный API. Управление приложениями доступно после входа в аккаунт.</p><Link href="/developers/console">Создать приложение <ArrowRight size={17} /></Link></div>
        <section id="start"><h2>Быстрый старт</h2><ol><li>В <Link href="/developers/console">консоли разработчика</Link> нажмите «Приложение» и укажите название.</li><li>Выберите нужные права и нажмите «Создать ключ». Скопируйте его сразу: целиком он показывается один раз.</li><li>Передавайте ключ в заголовке <code>Authorization: Bearer …</code> только с сервера вашего приложения.</li></ol></section>
        <section id="token"><h2><KeyRound size={21} /> Ключ и права</h2><p>Доступ определяется правами конкретного ключа. Ключ можно отозвать в консоли, а для разных интеграций создать отдельные ключи.</p><div className="developer-docs-table"><div><code>profile:read</code><span>Информация о приложении и владельце через <code>/api/public/v1/me</code>.</span></div><div><code>spaces:read</code><span>Список пространств владельца ключа через <code>/api/public/v1/spaces</code>.</span></div></div><p className="developer-docs-note"><ShieldCheck size={17} /> Ключ хранится на сервере вашей интеграции. Не вставляйте его в браузерный JavaScript и не публикуйте в репозитории.</p></section>
        <section id="requests"><h2>Запросы к API</h2><p>Подставьте ваш ключ в переменную окружения <code>FLIPZERO_API_TOKEN</code>. Эти маршруты сейчас предоставляют чтение данных.</p><h3>Проверить ключ</h3><pre><code>{`curl ${base}/api/public/v1/me \\\n  -H "Authorization: Bearer $FLIPZERO_API_TOKEN"`}</code></pre><p>Ответ содержит <code>application</code>, <code>owner</code> и <code>scopes</code>.</p><h3>Получить пространства</h3><pre><code>{`curl ${base}/api/public/v1/spaces \\\n  -H "Authorization: Bearer $FLIPZERO_API_TOKEN"`}</code></pre><p>Ответ содержит <code>data</code> со списком пространств владельца и <code>meta.count</code>. При отсутствии нужного права API вернёт <code>403 MISSING_SCOPE</code>.</p></section>
        <section id="install"><h2><Bot size={21} /> Установка в пространство</h2><p>После создания приложения откройте вкладку <strong>Bot</strong> в консоли. Там можно установить приложение в доступное вам пространство или скопировать ссылку приглашения <code>/oauth/install?app_id=…</code> для владельца другого пространства. Приложение получает события только после установки.</p></section>
        <section id="webhooks"><h2><Webhook size={21} /> События и OAuth</h2><p>Во вкладке <strong>Webhooks</strong> укажите HTTPS-адрес и выберите события: <code>message.created</code>, <code>member.joined</code>, <code>member.left</code>, <code>space.updated</code>. Подписывающий секрет показывается при создании; в консоли доступны тестовая доставка и журнал попыток.</p><p>Во вкладке <strong>OAuth</strong> можно зарегистрировать разрешённые адреса возврата и создать клиент для входа через FlipZero. Консоль сформирует ссылку авторизации с параметрами вашего приложения.</p></section>
        <footer><span>FlipZero Developer Platform</span><Link href="/developers/console">Перейти к приложениям <ArrowRight size={16} /></Link></footer>
      </article>
    </div>
  </div></main>;
}
