"use client";
import { useRef } from "react";
import Link from "next/link";
import { Crown, Menu } from "lucide-react";
export function MarketingMenu() { const menuRef = useRef<HTMLDetailsElement>(null); return (          <details className="fz-mobile-menu" ref={menuRef} onKeyDown={(event) => { if (event.key === "Escape" && menuRef.current) { menuRef.current.open = false; menuRef.current.querySelector("summary")?.focus(); } }} onClick={(event) => { if ((event.target as HTMLElement).closest("a") && menuRef.current) menuRef.current.open = false; }}>
            <summary aria-label="Открыть меню"><Menu size={20} /></summary>
            <nav>
              <Link href="/#features">Возможности</Link>
              <Link href="/#voice">Голос и видео</Link>
              <Link href="/#communities">Сообщества</Link>
              <Link href="/download">Скачать</Link>
              <Link className="fz-nav-super" href="/superflip"><Crown size={14} /> SUPER FLIP</Link>
              <Link href="/developers">Для разработчиков</Link>
              <Link href="/app">Открыть FlipZero</Link>
            </nav>
          </details>); }
