"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

type Invite = { code: string; spaceId: string; spaceName: string; description: string | null; accentColor: string; unavailable: boolean };

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch(`/api/v1/invites/${code}`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setInvite(data.invite); }).catch((reason) => setError(reason.message ?? "Приглашение недоступно.")).finally(() => setLoading(false)); }, [code]);

  async function join() {
    setJoining(true); setError("");
    const response = await fetch(`/api/v1/invites/${code}`, { method: "POST" });
    const data = await response.json();
    if (response.status === 401) { router.push(`/login?next=/invite/${code}`); return; }
    if (!response.ok) { setError(data.message ?? "Не удалось вступить."); setJoining(false); return; }
    router.push(`/channels/${data.spaceId}`); router.refresh();
  }

  return <main className="invite-page"><Link className="auth-brand invite-brand" href="/"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></Link><section className="invite-card">{loading ? <><LoaderCircle className="spin" size={30} /><h1>Проверяем приглашение</h1></> : invite ? <><div className="invite-space-icon" style={{ background: `linear-gradient(135deg, ${invite.accentColor}, #a83bd0)` }}>{invite.spaceName.slice(0, 2).toLocaleUpperCase("ru")}</div><span className="invite-kicker"><Link2 size={14} /> Вас приглашают</span><h1>{invite.spaceName}</h1><p>{invite.description || "Присоединяйтесь к пространству и начинайте общение."}</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}<button className="auth-submit" onClick={join} disabled={joining || invite.unavailable}>{joining ? <><LoaderCircle className="spin" size={18} /> Вступаем...</> : invite.unavailable ? "Приглашение недоступно" : <>Присоединиться <ArrowRight size={17} /></>}</button><small><ShieldCheck size={13} /> Безопасное приглашение FlipZero</small></> : <><Link2 size={30} /><h1>Ссылка недоступна</h1><p>{error}</p><Link className="invite-home-link" href="/">Вернуться на главную</Link></>}</section></main>;
}
