import { useRef, type Ref } from "react";

import { HomeSceneFallback } from "@/components/home/home-scene-fallback";
import { SafetyIcon } from "@/components/safety-icon";
import { HOME_SCENE_COPY } from "@/lib/home-scene-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { SafetyLevel } from "@/lib/labels";
import { SAFETY_SIGNAL_LEVELS, getSafetySignalCopy } from "@/lib/safety-copy";
import { cn } from "@/lib/utils";
import styles from "./home-story-scene-view.module.css";

type ControlMode = "scroll" | "stacked" | "spread";

type StorySceneViewProps = {
  className?: string;
  figureRef: Ref<HTMLElement>;
  hostRef: Ref<HTMLDivElement>;
  cueRef: Ref<HTMLDivElement>;
  label: string;
  locale: SeoRouteLocale;
  rendererState: "fallback" | "loading" | "ready" | "static" | "failed";
  selectedSignal: SafetyLevel;
  layoutMode: ControlMode;
  explanationId: string;
  playbackPaused: boolean;
  reducedMotion: boolean;
  pauseLabel: string;
  playLabel: string;
  onLayoutChange: (mode: ControlMode) => void;
  onSelect: (level: SafetyLevel) => void;
  onReset: () => void;
  onTogglePlayback: () => void;
};

/** A single transparent visual layer shared by the real, scrolling story sections. */
export function HomeStorySceneView({
  className, figureRef, hostRef, cueRef, label, locale, rendererState,
  selectedSignal, layoutMode, explanationId, playbackPaused, reducedMotion,
  pauseLabel, playLabel, onLayoutChange, onSelect, onReset, onTogglePlayback,
}: StorySceneViewProps) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const copy = HOME_SCENE_COPY[locale];
  const signals = getSafetySignalCopy(locale);
  const selected = signals.levels[selectedSignal];
  const ready = rendererState === "ready";
  const unavailable = rendererState === "failed" || rendererState === "static";
  const showLayoutControls = locale !== "ko" || ready;

  return (
    <figure
      ref={figureRef}
      className={cn(styles.scene, className)}
      data-renderer={rendererState}
      data-scene-variant="story"
      data-story-scene="true"
      data-layout-mode={layoutMode}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !disclosureRef.current?.open) return;
        disclosureRef.current.open = false;
        disclosureRef.current.querySelector("summary")?.focus();
      }}
    >
      <div className={styles.stage} data-home-scene-stage="true">
        <HomeSceneFallback
          className={cn(styles.fallback, ready && styles.hidden)}
          selectedSignal={selectedSignal}
        />
        <div
          ref={hostRef}
          aria-hidden="true"
          className={cn(styles.canvas, !ready && styles.hidden)}
        />
      </div>

      <div className={styles.toolbar} data-story-toolbar="true">
        <details ref={disclosureRef} className={styles.disclosure} data-story-controls="true">
          <summary className={styles.control}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14M7 3v4M13 8v4M8 13v4" />
            </svg>
            <span>{copy.controlsLabel}</span>
          </summary>
          <div className={styles.panel} data-scene-control-dock="true">
            {showLayoutControls && (
              <fieldset aria-label={copy.layoutLabel} data-scene-layout-controls="true">
                <legend>{copy.layoutLabel}</legend>
                <div className={styles.choices}>
                  {(["scroll", "stacked", "spread"] as const).map((mode) => (
                    <label key={mode} className={styles.choice}>
                      <input
                        type="radio"
                        name={`story-layout-${explanationId}`}
                        value={mode}
                        data-scene-layout={mode}
                        checked={layoutMode === mode}
                        disabled={!ready}
                        onChange={() => onLayoutChange(mode)}
                      />
                      <span>{mode === "scroll" ? copy.scrollLayout : mode === "stacked" ? copy.stackLabel : copy.spreadLabel}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {showLayoutControls && !ready && <p role="status">{unavailable ? copy.layoutUnavailable : copy.layoutLoading}</p>}
            <fieldset aria-label={copy.signalGroupLabel}>
              <legend>{copy.signalGroupLabel}</legend>
              <div className={styles.signals}>
                {SAFETY_SIGNAL_LEVELS.map((level) => (
                  <button
                    type="button"
                    key={level}
                    aria-pressed={selectedSignal === level}
                    aria-controls={explanationId}
                    data-scene-signal={level}
                    data-level={level}
                    onClick={() => onSelect(level)}
                  >
                    <SafetyIcon level={level} className={styles.signalIcon} />
                    {signals.levels[level].label}
                  </button>
                ))}
              </div>
            </fieldset>
            <p id={explanationId} role="status" aria-live="polite"><strong>{selected.label}</strong> · {selected.summary}</p>
            <p className={styles.notice}>{copy.educationNotice}</p>
            {showLayoutControls && (
              <button type="button" className={styles.control} data-scene-reset="true" disabled={!ready} onClick={onReset}>{copy.resetView}</button>
            )}
          </div>
        </details>

        <div ref={cueRef} className={styles.progress} data-scene-scroll-cue="true" hidden={layoutMode !== "scroll"}>
          <span className={styles.progressText}>{unavailable ? copy.layoutUnavailable : reducedMotion ? copy.scrollReduced : playbackPaused ? copy.scrollPaused : copy.scrollHint}</span>
          <span className={styles.track} aria-hidden="true"><span /></span>
        </div>
        {ready && (
          <button
            type="button"
            className={cn(styles.control, styles.playback)}
            aria-label={playbackPaused ? playLabel : pauseLabel}
            data-scene-playback="true"
            disabled={reducedMotion}
            onClick={onTogglePlayback}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none">
              {playbackPaused ? <path d="m5 3 9 6-9 6V3Z" fill="currentColor" /> : <path d="M5.5 3v12M12.5 3v12" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />}
            </svg>
          </button>
        )}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
