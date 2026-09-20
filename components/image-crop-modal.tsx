"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";

export function ImageCropModal({ file, aspect, onCancel, onConfirm }: { file: File; aspect: number; onCancel: () => void; onConfirm: (file: File) => void | Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onCancel(); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onCancel]);

  async function confirm() {
    const image = imageRef.current;
    if (!image) return;
    const outWidth = aspect > 1 ? 1600 : 800;
    const outHeight = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas"); canvas.width = outWidth; canvas.height = outHeight;
    const context = canvas.getContext("2d"); if (!context) return;
    const frame = image.parentElement!.getBoundingClientRect();
    const scale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) * zoom;
    const shownWidth = image.naturalWidth * scale; const shownHeight = image.naturalHeight * scale;
    const sourceWidth = frame.width / scale; const sourceHeight = frame.height / scale;
    const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) / 2 - offset.x / scale));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, (image.naturalHeight - sourceHeight) / 2 - offset.y / scale));
    context.drawImage(image, sourceX, sourceY, Math.min(sourceWidth, shownWidth / scale), Math.min(sourceHeight, shownHeight / scale), 0, 0, outWidth, outHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .85));
    if (blob) await onConfirm(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }));
  }

  return <div className="dialog-backdrop crop-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title"><header><div><small>РЕДАКТОР ИЗОБРАЖЕНИЯ</small><h2 id="crop-title">Выберите область</h2></div><button onClick={onCancel} aria-label="Закрыть"><X size={19} /></button></header><div className="crop-frame" style={{ aspectRatio: String(aspect) }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; }} onPointerMove={(event) => { if (!drag.current) return; setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(1, Math.min(3, value - event.deltaY * .002))); }}><img ref={imageRef} src={url} alt="Предпросмотр обрезки" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} /></div><p>Перетаскивайте фото для позиционирования. Используйте жест двумя пальцами или ползунок для масштаба.</p><div className="crop-controls"><Minus size={16} /><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Масштаб" /><Plus size={16} /></div><footer><button className="crop-cancel" onClick={onCancel}>Отмена</button><button className="crop-confirm" onClick={() => void confirm()}><Check size={17} /> Применить</button></footer></section></div>;
}
