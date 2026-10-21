"use client";

import { useEffect, useRef, useState } from "react";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";
import { createScratchCoverage, scratchPoint, SCRATCH_REVEAL_RATIO, type ScratchPoint } from "@/lib/meme-collectible-ui";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { MemeCollectibleArt } from "./meme-collectible-art";
import { MemeCollectibleSeal } from "./meme-collectible-seal";
import styles from "./meme-collectible.module.css";

export function MemeCollectibleScratch({ cardId, card, revealed, loading = false, unavailable = false, onStart, onReveal }: {
  cardId: string; card: MemeCollectibleCard | null; revealed: boolean; loading?: boolean; unavailable?: boolean; onStart: () => void; onReveal: () => void;
}) {
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onStart, onReveal });
  const revealRequested = useRef(revealed);
  useEffect(() => { callbacks.current = { onStart, onReveal }; }, [onStart, onReveal]);
  useEffect(() => { revealRequested.current = revealed; }, [cardId, revealed]);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const [coverVisible, setCoverVisible] = useState(!revealed);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setCoverVisible(false), 360);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  useEffect(() => {
    if (revealed || unavailable) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext("2d"); } catch { /* The keyboard alternative remains available. */ }
    if (!context) { canvas.dataset.canvasState = "unavailable"; return; }
    const ctx = context;
    const coverage = createScratchCoverage();
    const strokes: [ScratchPoint, ScratchPoint][] = [];
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let activePointer: number | null = null;
    let previous: ScratchPoint | null = null;
    let completed = false;
    let began = false;
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastDust = 0;
    const particles = new Set<HTMLSpanElement>();

    function drawStroke(from: ScratchPoint, to: ScratchPoint) {
      ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1;
      ctx.strokeStyle = "#000"; ctx.fillStyle = "#000";
      ctx.lineWidth = to.radiusX * width * 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
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
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      [[0, "#e0e7ec"], [.22, "#b6c6d5"], [.43, "#edeee6"], [.62, "#d2c9e8"], [.8, "#b9d9d6"], [1, "#e8eaf0"]].forEach(([stop, color]) => gradient.addColorStop(stop as number, color as string));
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,.27)"; ctx.lineWidth = 1;
      for (let x = -height; x < width; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke(); }
      ctx.strokeStyle = "rgba(40,51,69,.2)"; ctx.lineWidth = 1;
      for (const radius of [.25, .33, .41]) { ctx.beginPath(); ctx.ellipse(width / 2, height * .44, width * radius, width * radius, -.5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#263346"; ctx.textAlign = "center";
      ctx.font = `700 ${Math.max(10, width * .032)}px sans-serif`; ctx.fillText("MEMECATCH / COLLECTION", width / 2, height * .1);
      ctx.font = `800 ${Math.max(55, width * .31)}px sans-serif`; ctx.fillText("m↗", width / 2, height * .51);
      ctx.font = `700 ${Math.max(16, width * .066)}px sans-serif`; ctx.fillText(copy.foilTitle, width / 2, height * .77);
      ctx.font = `500 ${Math.max(11, width * .038)}px sans-serif`; ctx.fillText(copy.foilHint, width / 2, height * .83);
      for (const [from, to] of strokes) drawStroke(from, to);
      canvas!.style.background = "transparent"; canvas!.dataset.canvasState = "ready";
    }
    function pointFor(event: PointerEvent) {
      const point = scratchPoint(event.clientX, event.clientY, canvas!.getBoundingClientRect());
      if (!point) return null;
      const pressure = event.pointerType === "mouse" ? .5 : Math.max(.15, event.pressure || .35);
      const scale = .82 + pressure * .46;
      return { ...point, radiusX: point.radiusX * scale, radiusY: point.radiusY * scale };
    }
    function follow(event: PointerEvent) {
      if (completed) return;
      const point = pointFor(event);
      if (!point) { stage!.dataset.pointer = "false"; return; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        stage!.style.setProperty("--scratch-x", `${point.x * 100}%`);
        stage!.style.setProperty("--scratch-y", `${point.y * 100}%`);
        stage!.style.setProperty("--tilt-x", `${motion?.matches ? 0 : (point.y - .5) * -6}deg`);
        stage!.style.setProperty("--tilt-y", `${motion?.matches ? 0 : (point.x - .5) * 6}deg`);
        stage!.style.setProperty("--scratch-brush-scale", `${point.radiusX / .075}`);
        stage!.dataset.pointer = "true";
      });
    }
    function dust(point: ScratchPoint, event: PointerEvent) {
      if (motion?.matches || !dustRef.current || event.timeStamp - lastDust < 32) return;
      lastDust = event.timeStamp;
      for (let i = 0; i < 3 && particles.size < 36; i++) {
        const particle = document.createElement("span");
        particle.style.left = `${point.x * 100}%`; particle.style.top = `${point.y * 100}%`;
        particle.style.setProperty("--dust-x", `${(Math.random() - .5) * 85}px`);
        particle.style.setProperty("--dust-y", `${20 + Math.random() * 65}px`);
        particle.style.setProperty("--dust-turn", `${Math.random() * 180}deg`);
        particles.add(particle); dustRef.current.appendChild(particle);
        particle.addEventListener("animationend", () => { particles.delete(particle); particle.remove(); }, { once: true });
      }
    }
    function end(event?: PointerEvent) {
      if (event && activePointer !== event.pointerId) return;
      if (activePointer !== null && canvas!.hasPointerCapture?.(activePointer)) canvas!.releasePointerCapture(activePointer);
      activePointer = null; previous = null; stage!.dataset.dragging = "false";
    }
    function scratchSample(event: PointerEvent) {
      follow(event);
      if (completed || activePointer !== event.pointerId) return;
      const point = pointFor(event);
      if (!point) { previous = null; return; }
      if (!began) { began = true; setStarted(true); callbacks.current.onStart(); }
      const from = previous ?? point;
      strokes.push([from, point]); drawStroke(from, point); dust(point, event);
      const ratio = coverage.mark(from, point);
      previous = point; setProgress(Math.floor(ratio * 100));
      if (ratio >= SCRATCH_REVEAL_RATIO) { completed = true; revealRequested.current = true; setProgress(Math.ceil(SCRATCH_REVEAL_RATIO * 100)); end(); stage!.dataset.pointer = "false"; callbacks.current.onReveal(); }
    }
    function scratch(event: PointerEvent) {
      const samples = event.getCoalescedEvents?.() ?? [];
      if (!samples.length) { scratchSample(event); return; }
      for (const sample of samples) {
        scratchSample(sample);
        if (completed) break;
      }
    }
    function start(event: PointerEvent) {
      if (completed || activePointer !== null || (event.pointerType === "mouse" && event.button !== 0) || !width) return;
      activePointer = event.pointerId; canvas!.setPointerCapture?.(event.pointerId); stage!.dataset.dragging = "true"; scratch(event);
    }
    function leave() { if (activePointer === null) { stage!.dataset.pointer = "false"; stage!.style.setProperty("--tilt-x", "0deg"); stage!.style.setProperty("--tilt-y", "0deg"); } }
    paint();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    observer?.observe(canvas); window.addEventListener("resize", paint);
    canvas.addEventListener("pointerdown", start); canvas.addEventListener("pointermove", scratch); canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end); canvas.addEventListener("lostpointercapture", end);
    return () => { end(); cancelAnimationFrame(frame); for (const particle of particles) particle.remove(); observer?.disconnect(); window.removeEventListener("resize", paint); canvas.removeEventListener("pointerdown", start); canvas.removeEventListener("pointermove", scratch); canvas.removeEventListener("pointerleave", leave); canvas.removeEventListener("pointerup", end); canvas.removeEventListener("pointercancel", end); canvas.removeEventListener("lostpointercapture", end); };
  }, [cardId, revealed, unavailable, copy.foilTitle, copy.foilHint]);

  const normalizedProgress = Math.min(100, Math.round(progress / SCRATCH_REVEAL_RATIO));
  function revealWithKeyboard() {
    if (revealed || loading || unavailable || revealRequested.current) return;
    revealRequested.current = true;
    setStarted(true);
    setProgress(Math.ceil(SCRATCH_REVEAL_RATIO * 100));
    callbacks.current.onStart();
    callbacks.current.onReveal();
  }
  const nearReveal = normalizedProgress >= 70;
  return <div className={styles.scratchArea} data-card-id={cardId} data-scratch-progress={progress} data-revealed={revealed} data-near-reveal={nearReveal} data-scratch-state={revealed ? "revealed" : unavailable ? "error" : loading ? "loading" : started ? "scratching" : "sealed"}>
    <div ref={stageRef} className={styles.scratchCard} data-complete={revealed} data-pointer="false" data-dragging="false">
      {(revealed || started) && card ? <div aria-hidden={!revealed}><MemeCollectibleArt card={card}/></div> : <MemeCollectibleSeal label={copy.foilTitle} hint={copy.foilHint}/>}
      {coverVisible && <canvas ref={canvasRef} className={styles.scratchCanvas} role="button" tabIndex={revealed || unavailable ? -1 : 0} aria-label={`${copy.scratch}. ${copy.reveal}`} aria-disabled={loading || unavailable} aria-hidden={revealed} data-complete={revealed} data-canvas-state="pending" data-testid="scratch-canvas" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); revealWithKeyboard(); } }}/>}
      {!revealed && <><div className={styles.scratchShimmer} data-scratch-shimmer aria-hidden="true"/><div className={styles.scratchBrush} data-scratch-brush aria-hidden="true"/><div ref={dustRef} className={styles.scratchDust} data-scratch-dust aria-hidden="true"/></>}
      {revealed && <div className={styles.scratchRevealBurst} aria-hidden="true"/>}
    </div>
    {!revealed ? <div className={styles.scratchControls}><div className={styles.progressTrack} role="progressbar" aria-label={copy.revealProgress} aria-valuenow={normalizedProgress} aria-valuetext={`${normalizedProgress}%`} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${normalizedProgress}%` }}/></div><p className={styles.progress}>{copy.revealProgress} <strong>{normalizedProgress}%</strong></p><button type="button" className={styles.textButton} disabled={loading || unavailable} onClick={revealWithKeyboard}>{copy.reveal}</button></div> : <p className={styles.revealedStatus} role="status">✦ {copy.revealed}</p>}
  </div>;
}
