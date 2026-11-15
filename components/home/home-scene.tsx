"use client";

import { useEffect, useId, useRef, useState } from "react";

import { HomeSceneFallback } from "@/components/home/home-scene-fallback";
import type { HomeSceneRendererController } from "@/components/home/home-scene-renderer";
import { SafetyIcon } from "@/components/safety-icon";
import { HOME_SCENE_COPY } from "@/lib/home-scene-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { SafetyLevel } from "@/lib/labels";
import { SAFETY_SIGNAL_LEVELS, getSafetySignalCopy } from "@/lib/safety-copy";
import { cn } from "@/lib/utils";
import heroStyles from "./home-scene-hero.module.css";
import controlStyles from "./home-scene-controls.module.css";
import scrollStyles from "./home-scroll-story.module.css";
import { mountHomeScrollBinding } from "./home-scroll-binding";
import { HomeStorySceneView } from "./home-story-scene-view";

type SceneControlMode = "scroll" | "stacked" | "spread";

type RendererState = "fallback" | "loading" | "ready" | "static" | "failed";

type NavigatorWithPerformanceHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

export type HomeSceneProps = {
  className?: string;
  variant?: "studio" | "hero" | "story";
  label?: string;
  locale?: SeoRouteLocale;
  pauseLabel?: string;
  playLabel?: string;
};

const SIGNAL_STYLES: Record<SafetyLevel, string> = {
  green: "text-[#a8e4bd] aria-pressed:border-[#72c38f] aria-pressed:bg-[#183b29]",
  yellow: "text-[#f6d16f] aria-pressed:border-[#d9ad42] aria-pressed:bg-[#493915]",
  gray: "text-[#d3d5da] aria-pressed:border-[#969ca5] aria-pressed:bg-[#35383d]",
  red: "text-[#ff9d87] aria-pressed:border-[#df7158] aria-pressed:bg-[#4d241c]",
};

function shouldUseStaticFallback(navigatorValue: NavigatorWithPerformanceHints) {
  return navigatorValue.connection?.saveData === true
    || (navigatorValue.deviceMemory !== undefined && navigatorValue.deviceMemory <= 2);
}

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { powerPreference: "low-power" })
      ?? canvas.getContext("webgl", { powerPreference: "low-power" });

    context?.getExtension?.("WEBGL_lose_context")?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

export function HomeScene({
  className,
  variant = "studio",
  label = "A sculptural signal catcher orbiting four meme context signals",
  locale = "ko",
  pauseLabel = "Pause artwork",
  playLabel = "Play artwork",
}: HomeSceneProps) {
  const explanationId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);
  const scrollRefreshRef = useRef<(() => void) | null>(null);
  const scrollProgressRef = useRef(0);
  const modeRef = useRef<SceneControlMode>(variant !== "studio" ? "scroll" : "stacked");
  const controllerRef = useRef<HomeSceneRendererController | null>(null);
  const inViewportRef = useRef(false);
  const pageVisibleRef = useRef(true);
  const systemReducedMotionRef = useRef(false);
  const userPausedRef = useRef(false);
  const selectedSignalRef = useRef<SafetyLevel>("green");
  const [rendererState, setRendererState] = useState<RendererState>("fallback");
  const [selectedSignal, setSelectedSignal] = useState<SafetyLevel>("green");
  const [layoutMode, setLayoutMode] = useState<SceneControlMode>(variant !== "studio" ? "scroll" : "stacked");
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let importStarted = false;
    let observer: IntersectionObserver | null = null;
    let scrollBinding: ReturnType<typeof mountHomeScrollBinding> | null = null;
    let retainedLayoutTrack: HTMLElement | null = null;
    const disconnectScroll = () => {
      scrollBinding?.dispose();
      scrollBinding = null;
      scrollRefreshRef.current = null;
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    pageVisibleRef.current = document.visibilityState !== "hidden";
    if (reducedMotion.matches) {
      systemReducedMotionRef.current = true;
      queueMicrotask(() => {
        if (!disposed) setSystemReducedMotion(true);
      });
    }

    const isEffectivelyPaused = () => userPausedRef.current
      || systemReducedMotionRef.current
      || !inViewportRef.current
      || !pageVisibleRef.current;

    const syncPauseState = () => {
      controllerRef.current?.setPaused(isEffectivelyPaused());
      if (!isEffectivelyPaused()) scrollRefreshRef.current?.();
    };

    const handleVisibilityChange = () => {
      pageVisibleRef.current = document.visibilityState !== "hidden";
      syncPauseState();
    };

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      systemReducedMotionRef.current = event.matches;
      setSystemReducedMotion(event.matches);
      syncPauseState();
    };

    const loadRenderer = async () => {
      if (disposed || importStarted || !inViewportRef.current) return;
      importStarted = true;
      setRendererState("loading");

      try {
        const { mountHomeScene } = await import(
          "@/components/home/home-scene-renderer"
        );
        if (disposed) return;

        // Read the current geometry before the first draw, including restored scroll.
        const figure = figureRef.current;
        const stage = figure?.querySelector<HTMLElement>("[data-home-scene-stage]");
        const track = figure?.closest<HTMLElement>("[data-home-scroll-track]");
        const pin = track?.querySelector<HTMLElement>("[data-home-scroll-pin]");
        if (variant !== "studio" && stage && track && pin) {
          scrollBinding = mountHomeScrollBinding({
            stage, track, pin,
            range: track.querySelector<HTMLElement>("[data-home-scroll-range]") ?? track,
            onProgress(progress) {
              scrollProgressRef.current = progress;
              if (modeRef.current !== "scroll" || isEffectivelyPaused()) return;
              controllerRef.current?.setScrollProgress(progress);
              const cue = scrollCueRef.current;
              if (cue) {
                cue.style.setProperty("--scene-scroll-progress", String(progress));
                cue.dataset.phase = String(Math.min(2, Math.floor(progress * 3)));
              }
            },
          });
          scrollRefreshRef.current = scrollBinding.refresh;
        }
        const controller = mountHomeScene(host, {
          maxPixelRatio: 1.5,
          scrollProgress: modeRef.current === "scroll" && !systemReducedMotionRef.current
            ? scrollProgressRef.current : null,
          selectedSignal: selectedSignalRef.current,
          onSignalSelect: (level) => {
            selectedSignalRef.current = level;
            if (!disposed) setSelectedSignal(level);
          },
          paused: isEffectivelyPaused(),
          onContextLost: () => {
            // A runtime GPU failure must not collapse the section heights or
            // send the SVG back above a reader already in chapter two/three.
            if (variant === "story" && track) {
              retainedLayoutTrack = track;
              track.setAttribute("data-home-scroll-retained", "true");
            }
            disconnectScroll();
            controllerRef.current?.dispose();
            controllerRef.current = null;
            if (!disposed) {
              modeRef.current = "stacked";
              setLayoutMode("stacked");
              setRendererState("failed");
            }
          },
        });
        controllerRef.current = controller;
        scrollBinding?.refresh();
        setRendererState("ready");
      } catch {
        disconnectScroll();
        if (!disposed) setRendererState("failed");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.addEventListener("change", handleMotionPreference);

    const navigatorValue = navigator as NavigatorWithPerformanceHints;
    if (shouldUseStaticFallback(navigatorValue) || !supportsWebGl()) {
      queueMicrotask(() => {
        if (!disposed) setRendererState("static");
      });
    } else if (typeof IntersectionObserver === "undefined") {
      inViewportRef.current = true;
      void loadRenderer();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          inViewportRef.current = entry?.isIntersecting ?? false;
          if (inViewportRef.current) void loadRenderer();
          syncPauseState();
        },
        { rootMargin: variant === "story" ? "0px" : "96px", threshold: 0.05 },
      );
      observer.observe(host);
    }

    return () => {
      disposed = true;
      disconnectScroll();
      retainedLayoutTrack?.removeAttribute("data-home-scroll-retained");
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [variant]);

  const togglePlayback = () => {
    if (systemReducedMotionRef.current) return;
    const nextPaused = !userPausedRef.current;
    userPausedRef.current = nextPaused;
    setUserPaused(nextPaused);
    controllerRef.current?.setPaused(
      nextPaused || !inViewportRef.current || !pageVisibleRef.current,
    );
    if (!nextPaused) scrollRefreshRef.current?.();
  };

  const selectSignal = (level: SafetyLevel) => {
    selectedSignalRef.current = level;
    setSelectedSignal(level);
    controllerRef.current?.setSelectedSignal(level);
  };

  const resetView = () => {
    controllerRef.current?.resetView();
  };

  const changeLayout = (mode: SceneControlMode) => {
    if (!controllerRef.current) return;
    modeRef.current = mode;
    setLayoutMode(mode);
    if (mode === "scroll") {
      scrollRefreshRef.current?.();
      if (!userPausedRef.current && !systemReducedMotionRef.current) {
        controllerRef.current.setScrollProgress(scrollProgressRef.current);
      }
    } else {
      controllerRef.current.setScrollProgress(null);
      controllerRef.current.setLayoutMode(mode);
    }
  };

  const rendererReady = rendererState === "ready";
  const showLayoutControls = locale !== "ko" || rendererReady;
  const playbackPaused = userPaused || systemReducedMotion;
  const copy = HOME_SCENE_COPY[locale];
  const safetyCopy = getSafetySignalCopy(locale);
  const selectedCopy = safetyCopy.levels[selectedSignal];

  if (variant === "story") {
    return <HomeStorySceneView
      className={className}
      figureRef={figureRef}
      hostRef={hostRef}
      cueRef={scrollCueRef}
      label={label}
      locale={locale}
      rendererState={rendererState}
      selectedSignal={selectedSignal}
      layoutMode={layoutMode}
      explanationId={explanationId}
      playbackPaused={playbackPaused}
      reducedMotion={systemReducedMotion}
      pauseLabel={pauseLabel}
      playLabel={playLabel}
      onLayoutChange={changeLayout}
      onSelect={selectSignal}
      onReset={resetView}
      onTogglePlayback={togglePlayback}
    />;
  }

  return (
    <figure
      ref={figureRef}
      className={cn(
        "relative isolate w-full overflow-hidden rounded-[1.75rem] bg-[#17191a] shadow-[0_24px_70px_rgba(12,14,15,0.16)] ring-1 ring-black/10 dark:ring-white/10",
        className,
        variant === "hero" && heroStyles.hero,
      )}
      data-renderer={rendererState}
      data-scene-variant={variant}
      data-layout-mode={layoutMode}
    >
      <div
        className="relative h-64 overflow-hidden bg-[#17191a] sm:h-[340px] lg:h-[390px]"
        data-home-scene-stage="true"
      >
        {showLayoutControls && (
          <fieldset className={controlStyles.layout} aria-label={copy.layoutLabel} aria-describedby={!rendererReady ? `${explanationId}-layout-status` : undefined} data-scene-layout-controls="true">
            <legend className="sr-only">{copy.layoutLabel}</legend>
            {(variant === "hero" ? ["scroll", "stacked", "spread"] as const : ["stacked", "spread"] as const).map((mode) => (
              <label key={mode} className={controlStyles.choice}>
                <input
                  className={controlStyles.input}
                  type="radio"
                  name={`scene-layout-${explanationId}`}
                  value={mode}
                  checked={layoutMode === mode}
                  disabled={!rendererReady}
                  onChange={() => changeLayout(mode)}
                  data-scene-layout={mode}
                />
                <span className={controlStyles.label}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                    {mode === "scroll" ? <path d="M10 2v16M6 6l4-4 4 4M6 14l4 4 4-4" /> : mode === "stacked"
                      ? <path d="m10 3 7 4-7 4-7-4 7-4Zm-7 8 7 4 7-4M3 15l7 4 7-4" />
                      : <path d="m6 2 4 3-4 3-4-3 4-3Zm8 6 4 3-4 3-4-3 4-3ZM6 14l4 3-4 3-4-3 4-3Z" />}
                  </svg>
                  {mode === "scroll" ? copy.scrollLayout : mode === "stacked" ? copy.stackLabel : copy.spreadLabel}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {showLayoutControls && !rendererReady && (
          <p id={`${explanationId}-layout-status`} className={controlStyles.availability}>
            {rendererState === "static" || rendererState === "failed" ? copy.layoutUnavailable : copy.layoutLoading}
          </p>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(70,74,77,0.44),transparent_43%),linear-gradient(145deg,#202325_0%,#151718_58%,#101213_100%)]"
          data-scene-ambient="true"
        />
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
          data-scene-backplate="true"
        >
          <span
            aria-hidden="true"
            className="translate-x-[-0.025em] select-none text-[clamp(6.5rem,21vw,18rem)] font-black leading-none tracking-[-0.105em] text-white/[0.035]"
          >CATCH</span>
        </div>
        <p
          className="absolute top-4 left-4 z-20 text-[0.625rem] font-black uppercase tracking-[0.19em] text-white/70 sm:top-5 sm:left-5"
          data-scene-brand="true"
        >
          {copy.brandLabel}
        </p>
        <HomeSceneFallback
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-300 motion-reduce:transition-none ease-[cubic-bezier(0.32,0.72,0,1)]",
            rendererReady && "opacity-0",
          )}
          selectedSignal={selectedSignal}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-10 transition-opacity duration-300 motion-reduce:transition-none ease-[cubic-bezier(0.32,0.72,0,1)]",
            rendererReady ? "opacity-100" : "opacity-0",
          )}
          ref={hostRef}
        />

        <div className="absolute right-3 bottom-3 z-20 flex items-center gap-2 sm:right-5 sm:bottom-5">
          {showLayoutControls && (
            <button
              aria-label={copy.resetView}
              className="min-h-11 rounded-full bg-[#202325]/92 px-4 text-xs font-black text-[#f3f0eb] shadow-[0_10px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/15 transition-colors hover:bg-[#2a2d2f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7645] disabled:cursor-not-allowed disabled:opacity-45"
              data-scene-reset="true"
              disabled={!rendererReady}
              onClick={resetView}
              type="button"
            >
              {copy.resetView}
            </button>
          )}

          {rendererReady && (
            <button
              aria-label={playbackPaused ? playLabel : pauseLabel}
              className="grid size-11 place-items-center rounded-full bg-[#202325]/92 text-[#ff8a5e] shadow-[0_10px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/15 transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#2a2d2f] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7645] motion-reduce:transition-none"
              data-scene-playback="true"
              disabled={systemReducedMotion}
              onClick={togglePlayback}
              type="button"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 18 18">
                {playbackPaused ? (
                  <path d="m5 3 9 6-9 6V3Z" fill="currentColor" />
                ) : (
                  <path d="M5.5 3v12M12.5 3v12" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {variant === "hero" && (
        <div ref={scrollCueRef} className={scrollStyles.cue} data-scene-scroll-cue="true" hidden={layoutMode !== "scroll"}>
          {showLayoutControls && (
            <p>{rendererState === "static" || rendererState === "failed" ? copy.layoutUnavailable : systemReducedMotion ? copy.scrollReduced : userPaused ? copy.scrollPaused : !rendererReady ? copy.layoutLoading : copy.scrollHint}</p>
          )}
          <div className={scrollStyles.line} aria-hidden="true"><span /></div>
          <ol className={scrollStyles.steps}>
            {copy.scrollSteps.map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span>{step}</li>)}
          </ol>
        </div>
      )}

      <aside
        className="min-w-0 border-t border-white/10 bg-[#181a1b] p-3 sm:p-4"
        data-scene-control-dock="true"
      >
        <fieldset aria-label={copy.signalGroupLabel}>
          <legend className="sr-only">{copy.signalGroupLabel}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SAFETY_SIGNAL_LEVELS.map((level) => {
              const signal = safetyCopy.levels[level];
              return (
                <button
                  aria-controls={explanationId}
                  aria-pressed={selectedSignal === level}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#222527] px-3 py-2 text-left text-xs font-black transition-[background-color,border-color,transform] hover:bg-[#2a2d2f] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7645] motion-reduce:transition-none",
                    SIGNAL_STYLES[level],
                  )}
                  data-scene-signal={level}
                  key={level}
                  onClick={() => selectSignal(level)}
                  type="button"
                >
                  <SafetyIcon className="size-5 shrink-0" level={level} />
                  <span>{signal.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div
          aria-live="polite"
          className="mt-3 border-t border-white/10 pt-3 text-[#f6f3ee] sm:grid sm:grid-cols-[minmax(10rem,auto)_1fr] sm:items-baseline sm:gap-x-5"
          id={explanationId}
          role="status"
        >
          <p className="text-sm font-black">
            <span className="mr-2 text-[0.65rem] uppercase tracking-[0.14em] text-[#ff8a5e]">{copy.selectedSignalLabel}</span>
            {selectedCopy.label}
          </p>
          <p className="mt-1 text-sm leading-snug text-[#c6c9cb] sm:mt-0">{selectedCopy.summary}</p>
        </div>

        <div className="mt-2 border-t border-white/10">
          <details className="text-xs text-[#b9bdc0] open:pb-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-black text-[#f1eee8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7645]">
              <span className="shrink-0">{copy.disclosureLabel}</span>
              <span className="max-w-[65%] text-right text-[0.65rem] font-medium leading-relaxed text-[#aeb2b4]">{copy.educationNotice}</span>
            </summary>
            <p className="leading-relaxed">{selectedCopy.detail}</p>
            <p className="mt-2 leading-relaxed">{copy.interactionHint}</p>
            <p className="mt-2 leading-relaxed">{copy.demoDisclaimer}</p>
          </details>
        </div>
      </aside>

      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
