const READY_ATTRIBUTE = "data-home-scroll-ready";
const PROGRESS_ATTRIBUTE = "data-home-scroll-progress";
const PROGRESS_PROPERTY = "--home-scroll-progress";

type HomeScrollBindingOptions = {
  stage: HTMLElement;
  track: HTMLElement;
  /** Geometric chapter range, excluding navigation outside the story itself. */
  range?: HTMLElement;
  pin: HTMLElement;
  onProgress: (progress: number) => void;
};

type HomeScrollBinding = {
  refresh: () => void;
  dispose: () => void;
};

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function stickyProgress(track: HTMLElement, pin: HTMLElement, pinTop: string): number {
  const trackRect = track.getBoundingClientRect();
  const pinRect = pin.getBoundingClientRect();
  const computedTop = Number.parseFloat(pinTop);

  if (
    !Number.isFinite(computedTop)
    || !Number.isFinite(trackRect.top)
    || !Number.isFinite(trackRect.height)
    || !Number.isFinite(pinRect.height)
  ) {
    return 0;
  }

  const travel = Math.max(trackRect.height - pinRect.height, 1);
  return clampProgress((computedTop - trackRect.top) / travel);
}

function naturalFlowProgress(stage: HTMLElement): number {
  const stageRect = stage.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  if (
    !Number.isFinite(stageRect.top)
    || !Number.isFinite(stageRect.height)
    || stageRect.height <= 0
    || !Number.isFinite(viewportHeight)
    || viewportHeight <= 0
  ) {
    return 0;
  }

  const start = viewportHeight * 0.8;
  const end = -(stageRect.height * 0.4);
  const range = start - end;
  if (!Number.isFinite(range) || range <= 0) return 0;

  return clampProgress((start - stageRect.top) / range);
}

function restoreAttribute(element: HTMLElement, name: string, previousValue: string | null) {
  if (previousValue === null) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, previousValue);
}

/**
 * Binds native page scrolling to a normalized DOM geometry value without
 * owning any React or renderer state.
 */
export function mountHomeScrollBinding({
  stage,
  track,
  range = track,
  pin,
  onProgress,
}: HomeScrollBindingOptions): HomeScrollBinding {
  const previousReady = track.getAttribute(READY_ATTRIBUTE);
  const previousProgress = track.getAttribute(PROGRESS_ATTRIBUTE);
  const previousProgressProperty = track.style.getPropertyValue(PROGRESS_PROPERTY);
  const previousProgressPriority = track.style.getPropertyPriority(PROGRESS_PROPERTY);
  const scrollListenerOptions: AddEventListenerOptions = { passive: true };
  let disposed = false;
  let frameId: number | null = null;
  let lastWrittenProgress: string | null = null;

  const isHidden = () => document.visibilityState === "hidden";

  function computeProgress() {
    const pinStyle = window.getComputedStyle(pin);
    return pinStyle.position === "sticky"
      ? stickyProgress(range, pin, pinStyle.top)
      : naturalFlowProgress(stage);
  }

  function update() {
    if (disposed || isHidden()) return;

    const progress = computeProgress();
    const serializedProgress = String(progress);
    if (serializedProgress !== lastWrittenProgress) {
      track.setAttribute(PROGRESS_ATTRIBUTE, serializedProgress);
      track.style.setProperty(PROGRESS_PROPERTY, serializedProgress);
      lastWrittenProgress = serializedProgress;
    }
    onProgress(progress);
  }

  function cancelPendingFrame() {
    if (frameId === null) return;
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  function refresh() {
    if (disposed || isHidden()) return;
    cancelPendingFrame();
    update();
  }

  function scheduleUpdate() {
    if (disposed || isHidden() || frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      update();
    });
  }

  function onVisibilityChange() {
    if (isHidden()) {
      cancelPendingFrame();
      return;
    }
    refresh();
  }

  track.setAttribute(READY_ATTRIBUTE, "true");
  window.addEventListener("scroll", scheduleUpdate, scrollListenerOptions);
  window.addEventListener("resize", scheduleUpdate);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleUpdate)
    : null;
  resizeObserver?.observe(stage);
  resizeObserver?.observe(track);
  resizeObserver?.observe(pin);
  if (range !== track) resizeObserver?.observe(range);

  refresh();

  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelPendingFrame();
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", scheduleUpdate, scrollListenerOptions);
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      restoreAttribute(track, READY_ATTRIBUTE, previousReady);
      restoreAttribute(track, PROGRESS_ATTRIBUTE, previousProgress);
      if (previousProgressProperty) {
        track.style.setProperty(
          PROGRESS_PROPERTY,
          previousProgressProperty,
          previousProgressPriority,
        );
      } else {
        track.style.removeProperty(PROGRESS_PROPERTY);
      }
    },
  };
}
