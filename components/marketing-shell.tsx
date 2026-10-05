import { MarketingMenu } from "./marketing-menu";
import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

function Logo() {
  return (
    <span className="fz-logo">
      <span className="fz-logo-mark"><BrandMark size={34} /></span>
      <span className="fz-logo-copy"><strong>FlipZero</strong><small>Больше, чем общение</small></span>
    </span>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
 return <div className="fz-landing fz-marketing"><a className="fz-skip" href="#marketing-content">Перейти к содержимому</a>
      <header className="fz-header">
        <div className="fz-container fz-header-inner">
          <Link href="/" aria-label="FlipZero — главная"><Logo /></Link>
          <nav aria-label="Главная навигация">
            <Link href="/#features">Возможности</Link>
            <Link href="/#voice">Голос и видео</Link>
            <Link href="/#communities">Сообщества</Link>
            <Link href="/download">Скачать</Link>
            <Link className="fz-nav-super" href="/superflip"><Crown size={14} /> SUPER FLIP</Link>
            <Link href="/developers">Для разработчиков</Link>
          </nav>
          <Link className="fz-header-button" href="/app">Открыть FlipZero</Link>
          <MarketingMenu />
        </div>
      </header>
<div id="marketing-content">{children}</div>
      <footer className="fz-footer">
        <div className="fz-container">
          <div className="fz-footer-main">
            <div className="fz-footer-brand">
              <Link href="/" aria-label="FlipZero — главная"><Logo /></Link>
              <p>Чаты, голос, видео и сообщества в одном пространстве — без лишних барьеров.</p>
              <Link className="fz-footer-app-link" href="/app">Открыть FlipZero <ArrowRight size={15} /></Link>
            </div>

            <nav className="fz-footer-column" aria-label="Продукт">
              <strong>Продукт</strong>
              <Link href="/#features">Возможности</Link>
              <Link href="/#voice">Голос и видео</Link>
              <Link href="/#communities">Сообщества</Link>
              <Link href="/superflip">SUPER FLIP</Link>
            </nav>

            <nav className="fz-footer-column" aria-label="Ресурсы">
              <strong>Ресурсы</strong>
              <Link href="/download">Скачать</Link>
              <Link href="/developers">Для разработчиков</Link>
              <Link href="/login">Войти</Link>
              <Link href="/register">Создать аккаунт</Link>
            </nav>

            <nav className="fz-footer-column" aria-label="Документы">
              <strong>Документы</strong>
              <Link href="/privacy">Конфиденциальность</Link>
              <Link href="/terms">Условия использования</Link>
            </nav>
          </div>

          <div className="fz-footer-bottom">
            <span>© 2026 FlipZero. Больше, чем общение.</span>
            <a href="https://github.com/flipdanger94/flipzero/issues">Связаться с нами</a>
          </div>
        </div>
      </footer>
</div>;
}
