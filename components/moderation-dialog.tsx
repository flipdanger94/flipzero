"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, Bot, Check, Gavel, LoaderCircle, ShieldAlert, Trash2, X } from "lucide-react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Person = { userId?: string; id?: string; displayName: string; username: string };
type Case = { id: string; targetUserId: string; action: "warn" | "timeout" | "kick" | "ban" | "unban"; reason: string | null; expiresAt: string | null; createdAt: string; target: Person | null; moderator: Person | null };
type Flag = { id: string; messageId: string; authorId: string; category: string; severity: "medium" | "high"; confidence: number; summary: string; evidence: string[]; status: "pending" | "dismissed" | "actioned"; autoHidden: boolean; createdAt: string; content: string; channelId: string; channelName: string; displayName: string; username: string };
const labels = { warn: "Предупреждение", timeout: "Таймаут", kick: "Исключение", ban: "Блокировка", unban: "Разблокировка" } as const;
const statusLabels = { pending: "Ожидает решения", dismissed: "Разрешено", actioned: "Удалено" } as const;

export function ModerationDialog({
  const dialogRef = useModalA11y(onClose); spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [members, setMembers] = useState<Person[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [action, setAction] = useState<Case["action"]>("warn");
  const [section, setSection] = useState<"safety" | "actions">("safety");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingFlag, setWorkingFlag] = useState("");
  const [error, setError] = useState("");
  const pendingFlags = flags.filter((flag) => flag.status === "pending");
  const bannedPeople = useMemo(() => {
    const state = new Map<string, Person>();
    for (const item of [...cases].reverse()) { if (item.action === "ban" && item.target) state.set(item.targetUserId, item.target); if (item.action === "unban") state.delete(item.targetUserId); }
    return [...state.values()];
  }, [cases]);
  const targets = action === "unban" ? bannedPeople : members.filter((member) => member.userId !== ownerId);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/moderation`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setMembers(data.members); setCases(data.cases); setFlags(data.flags ?? []); setOwnerId(data.ownerId); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить журнал."); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [spaceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const targetUserId = String(form.get("targetUserId") ?? "");
    const body = { targetUserId, action, reason: String(form.get("reason") ?? ""), durationMinutes: Number(form.get("durationMinutes") ?? 60) };
    const response = await fetch(`/api/v1/spaces/${spaceId}/moderation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось применить действие.");
    const person = targets.find((item) => (item.userId ?? item.id) === targetUserId) ?? null;
    setCases((current) => [{ ...data.case, target: person, moderator: null }, ...current]);
    if (action === "kick" || action === "ban") setMembers((current) => current.filter((item) => item.userId !== targetUserId));
    formElement.reset();
  }

  async function reviewFlag(flagId: string, reviewAction: "dismiss" | "remove") {
    setWorkingFlag(flagId); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/moderation`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ flagId, action: reviewAction }) });
    const data = await response.json().catch(() => null); setWorkingFlag("");
    if (!response.ok) return setError(data?.message ?? "Не удалось сохранить решение.");
    setFlags((current) => current.map((flag) => flag.id === flagId ? { ...flag, status: data.status } : flag));
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="space-dialog moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>
      <div className="moderation-heading"><div className="dialog-symbol"><Gavel size={22} /></div><div><h2 id="moderation-title">Trust & Safety</h2><p>Автоматическая защита сообщений и действия модераторов.</p></div></div>
      <div className="trust-status"><span><Bot size={17} /></span><div><strong>Автомодерация активна</strong><small>Проверяет угрозы, мошенничество, персональные данные, травлю и спам.</small></div><b>{pendingFlags.length} на проверке</b></div>
      <nav className="moderation-tabs"><button className={section === "safety" ? "active" : ""} onClick={() => setSection("safety")}><ShieldAlert size={15} /> Очередь <b>{pendingFlags.length}</b></button><button className={section === "actions" ? "active" : ""} onClick={() => setSection("actions")}><Gavel size={15} /> Действия и журнал</button></nav>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем данные безопасности...</div> : section === "safety" ? <div className="flag-list">{flags.length ? flags.map((flag) => <article key={flag.id} className={`flag-card ${flag.status}`}><header><span className={`severity ${flag.severity}`}>{flag.severity === "high" ? "ВЫСОКИЙ РИСК" : "ТРЕБУЕТ ПРОВЕРКИ"}</span><small>{flag.confidence}% уверенности · {new Date(flag.createdAt).toLocaleString("ru-RU")}</small><b className={`flag-status ${flag.status}`}>{statusLabels[flag.status]}</b></header><div className="flag-meta"><strong>{flag.displayName} <span>@{flag.username}</span></strong><small>#{flag.channelName}{flag.autoHidden ? " · скрыто автоматически" : " · пока видно участникам"}</small></div><blockquote>{flag.content}</blockquote><p>{flag.summary}</p><div className="flag-signals">{flag.evidence.map((signal) => <span key={signal}>{signal}</span>)}</div>{flag.status === "pending" ? <footer><button className="flag-allow" disabled={workingFlag === flag.id} onClick={() => reviewFlag(flag.id, "dismiss")}><Check size={15} /> Разрешить</button><button className="flag-remove" disabled={workingFlag === flag.id} onClick={() => reviewFlag(flag.id, "remove")}>{workingFlag === flag.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Удалить сообщение</button></footer> : null}</article>) : <div className="invite-empty"><Bot size={29} /><strong>Срабатываний пока нет</strong><span>Новые подозрительные сообщения появятся здесь.</span></div>}</div> : <div className="moderation-layout"><form onSubmit={submit}><label><span>Действие</span><select value={action} onChange={(event) => setAction(event.target.value as Case["action"])}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Участник</span><select name="targetUserId" required><option value="">Выберите пользователя</option>{targets.map((person) => <option key={person.userId ?? person.id} value={person.userId ?? person.id}>{person.displayName} (@{person.username})</option>)}</select></label>{action === "timeout" ? <label><span>Длительность</span><select name="durationMinutes" defaultValue="60"><option value="10">10 минут</option><option value="60">1 час</option><option value="1440">1 день</option><option value="10080">7 дней</option></select></label> : null}<label><span>Причина</span><textarea name="reason" maxLength={500} rows={3} placeholder="Опишите причину действия" /></label><button className="auth-submit" disabled={working || targets.length === 0}>{working ? <LoaderCircle className="spin" size={17} /> : <><ShieldAlert size={16} /> Применить</>}</button></form><div className="audit-list"><h3>Последние действия</h3>{cases.length ? cases.map((item) => <article key={item.id}><i className={`audit-icon ${item.action}`}><Ban size={14} /></i><div><strong>{labels[item.action]} · {item.target?.displayName ?? "Пользователь"}</strong><span>{item.reason || "Причина не указана"}</span><small>{new Date(item.createdAt).toLocaleString("ru-RU")}{item.expiresAt ? ` · до ${new Date(item.expiresAt).toLocaleString("ru-RU")}` : ""}</small></div></article>) : <div className="invite-empty"><Gavel size={27} /><strong>Журнал пока пуст</strong><span>Здесь появятся действия модераторов.</span></div>}</div></div>}
    </section>
  </div>;
}
