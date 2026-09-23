"use client";
/* eslint-disable @next/next/no-img-element -- crop canvas needs a mutable HTMLImageElement backed by an object URL */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";

export function ImageCropModal({ file, aspect, onCancel, onConfirm }: { file: File; aspect: number; onCancel: () => void; onConfirm: (file: File) => void | Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onCancel(); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onCancel]);

  async function confirm() {
    const image = imageRef.current;
    if (!image?.naturalWidth || busy) return;
    setBusy(true);
    try {
    const outWidth = aspect > 1 ? 1600 : 800;
    const outHeight = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas"); canvas.width = outWidth; canvas.height = outHeight;
    const context = canvas.getContext("2d"); if (!context) return;
    const frame = frameRef.current!.getBoundingClientRect();
    const scale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) * zoom;
    const sourceWidth = frame.width / scale; const sourceHeight = frame.height / scale;
    const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) / 2 - offset.x / scale));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, (image.naturalHeight - sourceHeight) / 2 - offset.y / scale));
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outWidth, outHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .85));
    if (blob) await onConfirm(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }));
    } finally { setBusy(false); }
  }

  function boundedOffset(next: { x: number; y: number }, nextZoom = zoom) {
    const image = imageRef.current; const frame = frameRef.current;
    if (!image?.naturalWidth || !frame) return next;
    const width = frame.clientWidth; const height = frame.clientHeight;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * nextZoom;
    return {
      x: Math.max(-(image.naturalWidth * scale - width) / 2, Math.min((image.naturalWidth * scale - width) / 2, next.x)),
      y: Math.max(-(image.naturalHeight * scale - height) / 2, Math.min((image.naturalHeight * scale - height) / 2, next.y)),
    };
  }
  function changeZoom(next: number) { const value = Math.max(1, Math.min(3, next)); setZoom(value); setOffset((current) => boundedOffset(current, value)); }

  return <div className="dialog-backdrop crop-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title"><header><div><small>РЕДАКТОР ИЗОБРАЖЕНИЯ</small><h2 id="crop-title">Выберите область {aspect === 16 / 9 ? "· 16:9" : ""}</h2></div><button onClick={onCancel} aria-label="Закрыть"><X size={19} /></button></header><div ref={frameRef} className="crop-frame" style={{ aspectRatio: String(aspect) }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; }} onPointerMove={(event) => { if (!drag.current) return; setOffset(boundedOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onWheel={(event) => { event.preventDefault(); changeZoom(zoom - event.deltaY * .002); }}><img ref={imageRef} src={url} alt="Предпросмотр обрезки" onLoad={() => setLoaded(true)} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} /></div><p>Перетаскивайте фото для позиционирования. Масштаб регулируется ползунком или колесом мыши.</p><div className="crop-controls"><Minus size={16} /><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} aria-label="Масштаб" /><Plus size={16} /></div><footer><button className="crop-cancel" onClick={onCancel}>Отмена</button><button className="crop-confirm" disabled={!loaded || busy} onClick={() => void confirm()}><Check size={17} /> {busy ? "Обрабатываем…" : "Применить"}</button></footer></section></div>;
}
