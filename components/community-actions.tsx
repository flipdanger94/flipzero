"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Share2 } from "lucide-react";

export function CommunityActions({ spaceId, slug, channelId, visibility, joinRequestStatus, isMember, isAuthenticated, requestedChannelId }: { spaceId: string; slug: string; channelId: string | null; visibility: string; joinRequestStatus: string | null; isMember: boolean; isAuthenticated: boolean; requestedChannelId: string | null }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [requestStatus, setRequestStatus] = useState(joinRequestStatus);
  const canonicalCommunityPath = `/communities/${encodeURIComponent(slug)}`;
  const communityPath = requestedChannelId ? `${canonicalCommunityPath}?channel=${encodeURIComponent(requestedChannelId)}` : canonicalCommunityPath;
  const channelPath = channelId ? `/channels/${encodeURIComponent(spaceId)}/${encodeURIComponent(channelId)}` : "/app";

  async function join() {
    let message = "";
    if (visibility === "application") {
      const value = window.prompt("Коротко расскажите, почему хотите вступить (необязательно):", "");
      if (value === null) return;
      message = value;
    }
    setJoining(true);
    setError("");
    try {
      const response = await fetch("/api/v1/discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spaceId, message }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.message ?? "Не удалось отправить запрос.");
        return;
      }
      if (result.joined) {
        router.push(channelPath);
        router.refresh();
      } else {
        setRequestStatus(result.requestStatus ?? "pending");
      }
    } catch {
      setError("Нет соединения. Попробуйте ещё раз.");
    } finally {
      setJoining(false);
    }
  }

  async function copy() {
    const url = `${window.location.origin}${canonicalCommunityPath}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch (reason) {
        if (reason instanceof Error && reason.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не удалось скопировать ссылку.");
    }
  }

  return <div className="community-actions">
    {isMember ? <Link className="community-primary" href={channelPath}>Открыть сообщество <ArrowRight size={18} /></Link> : isAuthenticated ? <button className="community-primary" onClick={join} disabled={joining || requestStatus === "pending"}>{joining ? <><LoaderCircle className="spin" size={18} /> Отправляем...</> : requestStatus === "pending" ? <>Заявка отправлена <Check size={18} /></> : visibility === "application" ? <>Подать заявку <ArrowRight size={18} /></> : <>Вступить в сообщество <ArrowRight size={18} /></>}</button> : <Link className="community-primary" href={`/login?next=${encodeURIComponent(communityPath)}`}>{visibility === "application" ? "Войти и подать заявку" : "Войти и вступить"} <ArrowRight size={18} /></Link>}
    <button className="community-copy" onClick={copy}>{copied ? <Check size={17} /> : <Share2 size={17} />}{copied ? "Ссылка скопирована" : "Поделиться ссылкой"}</button>
    {error ? <p className="community-action-error" role="alert">{error}</p> : null}
  </div>;
}
