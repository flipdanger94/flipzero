"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, Gavel, LoaderCircle, ShieldAlert, X } from "lucide-react";

type Person = { userId?: string; id?: string; displayName: string; username: string };
type Case = { id: string; targetUserId: string; action: "warn" | "timeout" | "kick" | "ban" | "unban"; reason: string | null; expiresAt: string | null; createdAt: string; target: Person | null; moderator: Person | null };
const labels = { warn: "Предупреждение", timeout: "Таймаут", kick: "Исключение", ban: "Блокировка", unban: "Разблокировка" } as const;

export function ModerationDialog({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [members, setMembers] = useState<Person[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [action, setAction] = useState<Case["action"]>("warn");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const bannedPeople = useMemo(() => {
    const state = new Map<string, Person>();
    for (const item of [...cases].reverse()) { if (item.action === "ban" && item.target) state.set(item.targetUserId, item.target); if (item.action === "unban") state.delete(item.targetUserId); }
    return [...state.values()];
  }, [cases]);
  const targets = action === "unban" ? bannedPeople : members.filter((member) => member.userId !== ownerId);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/moderation`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setMembers(data.members); setCases(data.cases); setOwnerId(data.ownerId); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить журнал."); }).finally(() => setLoading(false));
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

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Gavel size={22} /></div><h2 id="moderation-title">Модерация и журнал</h2><p>Применяйте меры и отслеживайте историю действий.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="role-loading"><LoaderCircle className="spin" size={22} /> Загружаем журнал...</div> : <div className="moderation-layout"><form onSubmit={submit}><label><span>Действие</span><select value={action} onChange={(event) => setAction(event.target.value as Case["action"])}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Участник</span><select name="targetUserId" required><option value="">Выберите пользователя</option>{targets.map((person) => <option key={person.userId ?? person.id} value={person.userId ?? person.id}>{person.displayName} (@{person.username})</option>)}</select></label>{action === "timeout" ? <label><span>Длительность</span><select name="durationMinutes" defaultValue="60"><option value="10">10 минут</option><option value="60">1 час</option><option value="1440">1 день</option><option value="10080">7 дней</option></select></label> : null}<label><span>Причина</span><textarea name="reason" maxLength={500} rows={3} placeholder="Опишите причину действия" /></label><button className="auth-submit" disabled={working || targets.length === 0}>{working ? <LoaderCircle className="spin" size={17} /> : <><ShieldAlert size={16} /> Применить</>}</button></form><div className="audit-list"><h3>Последние действия</h3>{cases.length ? cases.map((item) => <article key={item.id}><i className={`audit-icon ${item.action}`}><Ban size={14} /></i><div><strong>{labels[item.action]} · {item.target?.displayName ?? "Пользователь"}</strong><span>{item.reason || "Причина не указана"}</span><small>{new Date(item.createdAt).toLocaleString("ru-RU")}{item.expiresAt ? ` · до ${new Date(item.expiresAt).toLocaleString("ru-RU")}` : ""}</small></div></article>) : <div className="invite-empty"><Gavel size={27} /><strong>Журнал пока пуст</strong><span>Здесь появятся действия модераторов.</span></div>}</div></div>}</section></div>;
}
