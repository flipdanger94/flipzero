"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Gauge, LoaderCircle, RefreshCw, Server, ShieldCheck, Radio, X } from "lucide-react";
import { Dialog } from "./ui/dialog";

type Health = {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
  durationMs: number;
  deployment: { environment: string; region: string; commit: string };
  checks: { api: { status: string; latencyMs: number }; database: { status: string; latencyMs: number | null }; schema: { status: string }; voice: { status: string; checkedAt: string }; chat: { status: string } };
  slo: { availabilityTarget: number; apiP95TargetMs: number; databaseP95TargetMs: number; lcpTargetMs: number; inpTargetMs: number; clsTarget: number };
};

export function SystemStatusDialog({onClose }: { onClose: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json();
      setHealth(data);
      if (!response.ok) setError("Один из сервисов работает нестабильно.");
    } catch {
      setError("Не удалось получить состояние системы.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refreshTimer = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  const apiGood = Boolean(health && health.checks.api.status === "ok" && health.checks.api.latencyMs <= health.slo.apiP95TargetMs);
  const databaseGood = Boolean(health && health.checks.database.status === "ok" && (health.checks.database.latencyMs ?? Infinity) <= health.slo.databaseP95TargetMs);

  return <Dialog backdropClassName="dialog-backdrop" className="space-dialog system-status-dialog" labelledBy="system-status-title" onClose={onClose}><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><header className="system-status-heading"><span className="dialog-symbol"><Activity size={22} /></span><div><small>FLIPZERO STATUS</small><h2 id="system-status-title">Состояние системы</h2><p>Проверка обновляется автоматически каждые 30 секунд.</p></div><button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} /> Обновить</button></header>{error ? <div className="status-warning">{error}</div> : null}{!health && loading ? <div className="status-loading"><LoaderCircle className="spin" size={25} /> Проверяем сервисы...</div> : health ? <><section className={`overall-status ${health.status}`}><i /><div><strong>{health.status === "ok" ? "Проверенные сервисы доступны" : "Обнаружена деградация"}</strong><span>Версия {health.version} · регион {health.deployment.region} · commit {health.deployment.commit}</span></div><b>{health.durationMs} мс</b></section><div className="service-grid"><article><span className={apiGood ? "good" : "slow"}><Server size={20} /></span><div><small>API</small><strong>{health.checks.api.status === "ok" ? "Работает" : "Ошибка"}</strong><p>Текущий ответ: {health.checks.api.latencyMs} мс</p></div><b>{apiGood ? "Быстрый ответ" : "CHECK"}</b></article><article><span className={databaseGood ? "good" : "slow"}><Database size={20} /></span><div><small>POSTGRESQL</small><strong>{health.checks.database.status === "ok" ? "Подключена" : "Недоступна"}</strong><p>Текущий запрос: {health.checks.database.latencyMs ?? "—"} мс</p></div><b>{databaseGood ? "Быстрый запрос" : "CHECK"}</b></article><article><span className={health.checks.schema.status === "ok" ? "good" : "slow"}><ShieldCheck size={20}/></span><div><small>СХЕМА ДАННЫХ</small><strong>{health.checks.schema.status === "ok" ? "Готова" : "Нужны миграции"}</strong><p>Таблицы чатов, звонков и XP</p></div></article><article><span className={health.checks.voice.status === "ok" ? "good" : "slow"}><Radio size={20}/></span><div><small>ГОЛОСОВОЙ СЕРВИС</small><strong>{health.checks.voice.status === "ok" ? "Доступен" : health.checks.voice.status === "not_configured" ? "Не настроен" : "Недоступен"}</strong><p>Проверка соединения с сервером</p></div></article></div><p className="status-footer">Доставка сообщений, микрофон и видеопоток требуют отдельной проверки. Этот экран показывает доступность сервисов.</p><section className="slo-panel"><header><Gauge size={18} /><div><strong>Цели надёжности</strong><span>Пороговые значения для production</span></div></header><div><span><small>Доступность</small><b>{health.slo.availabilityTarget}%</b></span><span><small>API p95</small><b>&lt; {health.slo.apiP95TargetMs} мс</b></span><span><small>DB p95</small><b>&lt; {health.slo.databaseP95TargetMs} мс</b></span><span><small>LCP</small><b>&lt; {health.slo.lcpTargetMs / 1000} сек</b></span><span><small>INP</small><b>&lt; {health.slo.inpTargetMs} мс</b></span><span><small>CLS</small><b>&lt; {health.slo.clsTarget}</b></span></div></section><footer className="status-footer">Последняя проверка: {new Date(health.timestamp).toLocaleString("ru-RU")} · показатели Web Vitals собираются через Vercel Speed Insights.</footer></> : null}</Dialog>;
}
