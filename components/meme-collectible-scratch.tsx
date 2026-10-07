"use client";

import { useEffect, useRef, useState } from "react";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";
import { createScratchCoverage, scratchPoint, SCRATCH_REVEAL_RATIO, type ScratchPoint } from "@/lib/meme-collectible-ui";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { MemeCollectibleArt } from "./meme-collectible-art";
import styles from "./meme-collectible.module.css";

export function MemeCollectibleScratch({ card, revealed, onReveal }: { card: MemeCollectibleCard; revealed: boolean; onReveal: () => void }) {
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onRevealRef = useRef(onReveal);
  useEffect(() => { onRevealRef.current = onReveal; }, [onReveal]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext("2d"); } catch { /* The reveal button remains available. */ }
    if (!context) return;
    const ctx = context;
    const coverage = createScratchCoverage();
    const strokes: [ScratchPoint, ScratchPoint][] = [];
    let activePointer: number | null = null;
    let previous: ScratchPoint | null = null;
    let completed = false;
    let width = 0;
    let height = 0;

    function drawStroke(from: ScratchPoint, to: ScratchPoint) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      ctx.lineWidth = to.radiusX * width * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(from.x * width, from.y * height); ctx.lineTo(to.x * width, to.y * height); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(to.x * width, to.y * height, to.radiusX * width, to.radiusY * height, 0, 0, Math.PI * 2); ctx.fill();
    }
    function paint() {
      const rect = canvas!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      width = rect.width; height = rect.height;
      const density = Math.min(window.devicePixelRatio || 1, 3);
      canvas!.width = Math.round(width * density); canvas!.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f79b67"); gradient.addColorStop(0.5, "#e76536"); gradient.addColorStop(1, "#bb4928");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,246,228,.18)"; ctx.lineWidth = 1;
      for (let x = -height; x < width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke(); }
      ctx.fillStyle = "#fff6e4"; ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(12, width * 0.045)}px sans-serif`; ctx.fillText("MEMECATCH", width / 2, height * 0.27);
      ctx.font = `900 ${Math.max(24, width * 0.115)}px sans-serif`; ctx.fillText("SCRATCH", width / 2, height * 0.46); ctx.fillText("TO REVEAL", width / 2, height * 0.56);
      ctx.font = `500 ${Math.max(12, width * 0.043)}px monospace`; ctx.fillText(`#${String(card.cardNo).padStart(4, "0")} · FREE TO COLLECT`, width / 2, height * 0.73);
      for (const [from, to] of strokes) drawStroke(from, to);
    }
    function end(event?: PointerEvent) {
      if (event && activePointer !== event.pointerId) return;
      if (activePointer !== null && canvas!.hasPointerCapture?.(activePointer)) canvas!.releasePointerCapture(activePointer);
      activePointer = null; previous = null;
    }
    function scratch(event: PointerEvent) {
      if (completed || activePointer !== event.pointerId) return;
      const point = scratchPoint(event.clientX, event.clientY, canvas!.getBoundingClientRect());
      if (!point) { previous = null; return; }
      const from = previous ?? point;
      strokes.push([from, point]); drawStroke(from, point);
      const ratio = coverage.mark(from, point);
      previous = point; setProgress(Math.floor(ratio * 100));
      if (ratio >= SCRATCH_REVEAL_RATIO) { completed = true; end(); onRevealRef.current(); }
    }
    function start(event: PointerEvent) {
      if (activePointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
      activePointer = event.pointerId; canvas!.setPointerCapture?.(event.pointerId); scratch(event);
    }
    paint();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", paint);
    canvas.addEventListener("pointerdown", start); canvas.addEventListener("pointermove", scratch);
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end); canvas.addEventListener("lostpointercapture", end);
    return () => { end(); observer?.disconnect(); window.removeEventListener("resize", paint); canvas.removeEventListener("pointerdown", start); canvas.removeEventListener("pointermove", scratch); canvas.removeEventListener("pointerup", end); canvas.removeEventListener("pointercancel", end); canvas.removeEventListener("lostpointercapture", end); };
  }, [card.id, card.cardNo, revealed]);

  return <div className={styles.scratchArea} data-card-id={card.id} data-scratch-progress={progress} data-revealed={revealed}>
    <div className={styles.scratchCard}>
      <div aria-hidden={!revealed}><MemeCollectibleArt card={card}/></div>
      {!revealed && <canvas ref={canvasRef} className={styles.scratchCanvas} aria-label={copy.scratch} data-testid="scratch-canvas"/>}
    </div>
    {!revealed ? <div className={styles.scratchControls}><p>{copy.scratch}</p><p className={styles.progress}>{copy.progress} {progress}%</p><button type="button" className={styles.secondaryButton} onClick={onReveal}>{copy.reveal}</button></div> : <p className={styles.revealedStatus} role="status">✦ {copy.revealed}</p>}
  </div>;
}
