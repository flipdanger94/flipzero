"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export type CosmeticArtItem = {
  title: string;
  preview: string;
  previewImage?: string | null;
  previewAnimation?: string | null;
  isAnimated?: boolean;
  isBundle?: boolean;
};

function isAssetUrl(value?: string | null) {
  return Boolean(value && (/^(https?:|data:|blob:|\/)/.test(value) || /\.(gif|webp|png|jpe?g|avif|webm|mp4|json)(\?|$)/i.test(value)));
}

function LottieFallback({ source, label }: { source: string; label: string }) {
  const [valid, setValid] = useState(false);
  useEffect(() => {
    let live = true;
    void fetch(source, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("animation failed");
        return response.json();
      })
      .then((data) => {
        if (live && data && typeof data === "object") setValid(true);
      })
      .catch(() => {
        if (live) setValid(false);
      });
    return () => { live = false; };
  }, [source]);
  return <div className={`cosmetic-art-lottie-fallback ${valid ? "is-valid-json" : ""}`} aria-label={label}><Sparkles size={46}/></div>;
}

export function CosmeticArt({
  item,
  live = false,
  className = "",
}: {
  item: CosmeticArtItem;
  live?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animation = failed ? null : item.previewAnimation;
  const cssToken = animation?.startsWith("css:") ? animation.slice(4) : null;
  const fallback = item.previewImage ?? item.preview;
  const source = live && animation && !cssToken ? animation : null;
  const mode = useMemo(() => source?.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ?? "", [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (live) void video.play().catch(() => undefined);
    else video.pause();
  }, [live, source]);

  const visualClass = `cosmetic-art visual-${cssToken ?? item.preview} ${item.isAnimated ? "is-animated" : ""} ${live ? "is-live" : ""} ${item.isBundle ? "is-bundle" : ""} ${className}`.trim();

  if (source && /^(webm|mp4)$/.test(mode)) {
    return <div className={visualClass}>
      <video ref={videoRef} src={source} muted loop playsInline preload="metadata" onError={() => setFailed(true)} aria-label={item.title}/>
    </div>;
  }
  if (source && mode === "json") {
    return <div className={visualClass}><LottieFallback source={source} label={item.title}/></div>;
  }
  if (source && isAssetUrl(source)) {
    return <div className={visualClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={source} alt="" onError={() => setFailed(true)} />
    </div>;
  }
  if (!cssToken && isAssetUrl(fallback)) {
    return <div className={visualClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fallback} alt="" onError={() => setFailed(true)} />
    </div>;
  }
  return <div className={visualClass} aria-label={item.title}>
    <span className="cosmetic-art-avatar">FZ</span>
    <i className="cosmetic-art-ring"/>
    <i className="cosmetic-art-spark one"/>
    <i className="cosmetic-art-spark two"/>
    <i className="cosmetic-art-spark three"/>
  </div>;
}
