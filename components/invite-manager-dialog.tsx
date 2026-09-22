"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Invite = { code: string; uses: number; maxUses: number | null; expiresAt: string | null; createdAt: string };

export function InviteManagerDialog({
  const dialogRef = useModalA11y(onClose); spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [items, setItems] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { fetch(`/api/v1/spaces/${spaceId}/invites`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setItems(data.invites); }).catch((reason) => setError(reason.message ?? "Не удалось загрузить приглашения.")).finally(() => setLoading(false)); }, [spaceId]);

  async function createInvite() {
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/invites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 7, maxUses: 25 }) });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось создать приглашение.");
    setItems((current) => [data.invite, ...current]);
  }

  async function copyInvite(code: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
    setCopied(code); window.setTimeout(() => setCopied(null), 1600);
  }

  async function removeInvite(code: string) {
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/invites?code=${encodeURIComponent(code)}`, { method: "DELETE" });
    const data = await response.json(); setWorking(false);
    if (!response.ok) return setError(data.message ?? "Не удалось удалить приглашение.");
    setItems((current) => current.filter((invite) => invite.code !== code));
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="dialog-symbol"><Link2 size={22} /></div><h2 id="invite-title">Приглашения</h2><p>Ссылка действует 7 дней и доступна для 25 вступлений.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}<button className="auth-submit invite-create" onClick={createInvite} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <><Plus size={17} /> Создать приглашение</>}</button>{loading ? <div className="invite-empty"><LoaderCircle className="spin" size={22} /> Загружаем...</div> : items.length ? <div className="invite-list">{items.map((invite) => { const expired = invite.expiresAt ? new Date(invite.expiresAt) <= new Date() : false; return <article key={invite.code}><div><strong>{invite.code}</strong><span>{expired ? "Истекло" : `Использовано ${invite.uses} из ${invite.maxUses ?? "∞"}`} · {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString("ru-RU") : "без срока"}</span></div><button aria-label="Скопировать ссылку" onClick={() => copyInvite(invite.code)}>{copied === invite.code ? <Check size={16} /> : <Copy size={16} />}</button><button className="invite-delete" aria-label="Удалить приглашение" onClick={() => removeInvite(invite.code)}><Trash2 size={16} /></button></article>})}</div> : <div className="invite-empty"><Link2 size={25} /><strong>Активных ссылок нет</strong><span>Создайте приглашение и отправьте его участникам.</span></div>}</section></div>;
}
