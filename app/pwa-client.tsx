"use client";

import { useEffect, useState } from "react";
import { Download, Share, WifiOff, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "flipzero:pwa-dismissed-at";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function PwaClient() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!standalone && Date.now() - dismissedAt > WEEK && isIos) window.setTimeout(() => { setShowIosHelp(true); setShowInstall(true); }, 0);
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); if (!standalone && Date.now() - dismissedAt > WEEK) setShowInstall(true); };
    const onInstalled = () => { setShowInstall(false); setInstallPrompt(null); };
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.setTimeout(syncOnline, 0);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); window.removeEventListener("online", syncOnline); window.removeEventListener("offline", syncOnline); };
  }, []);

  async function install() {
    if (!installPrompt) { setShowIosHelp(true); return; }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setShowInstall(false);
    setInstallPrompt(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowInstall(false);
    setShowIosHelp(false);
  }

  return <>{!online ? <div className="offline-toast" role="status"><WifiOff size={15} /> Нет соединения. Ждём восстановления сети…</div> : null}{showInstall ? <aside className="install-app-card" aria-label="Установить FlipZero"><button className="install-close" onClick={dismiss} aria-label="Закрыть"><X size={15} /></button><span className="install-mark">FZ</span><div><strong>Установить FlipZero</strong><small>{showIosHelp ? <>Откройте в Safari, нажмите <Share size={14} aria-label="Поделиться" /> «Поделиться» → «На экран Домой».</> : "Откройте чаты как отдельное приложение."}</small></div><button className="install-action" onClick={showIosHelp ? dismiss : install}>{showIosHelp ? null : <Download size={15} />} {showIosHelp ? "Понятно" : "Установить"}</button></aside> : null}</>;
}
