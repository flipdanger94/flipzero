"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";

export function CommunityActions({ spaceId, slug, channelId, isMember, isAuthenticated, requestedChannelId }: { spaceId: string; slug: string; channelId: string | null; isMember: boolean; isAuthenticated: boolean; requestedChannelId: string | null }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const canonicalCommunityPath = `/communities/${encodeURIComponent(slug)}`;
  const communityPath = requestedChannelId ? `${canonicalCommunityPath}?channel=${encodeURIComponent(requestedChannelId)}` : canonicalCommunityPath;
  const channelPath = channelId ? `/channels/${encodeURIComponent(spaceId)}/${encodeURIComponent(channelId)}` : "/app";

  async function join() {
    setJoining(true);
    setError("");
    try {
      const response = await fetch("/api/v1/discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spaceId }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.message ?? "Не удалось вступить в сообщество.");
        return;
      }
      router.push(channelPath);
      router.refresh();
    } catch {
      setError("Нет соединения. Попробуйте ещё раз.");
    } finally {
      setJoining(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${canonicalCommunityPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не удалось скопировать ссылку.");
    }
  }

  return <div className="community-actions">
    {isMember ? <Link className="community-primary" href={channelPath}>Открыть сообщество <ArrowRight size={18} /></Link> : isAuthenticated ? <button className="community-primary" onClick={join} disabled={joining}>{joining ? <><LoaderCircle className="spin" size={18} /> Вступаем...</> : <>Вступить в сообщество <ArrowRight size={18} /></>}</button> : <Link className="community-primary" href={`/login?next=${encodeURIComponent(communityPath)}`}>Войти и вступить <ArrowRight size={18} /></Link>}
    <button className="community-copy" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
    {error ? <p className="community-action-error" role="alert">{error}</p> : null}
  </div>;
}
