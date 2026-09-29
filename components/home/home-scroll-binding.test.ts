// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountHomeScrollBinding } from "./home-scroll-binding";

type MutableRect = {
  height: number;
  top: number;
};

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function installAnimationFrames() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => callbacks.delete(id));

  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  return {
    cancel,
    flush(time = 16) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    },
    pending: () => callbacks.size,
    request,
  };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

function installRect(element: HTMLElement, rect: MutableRect) {
  element.getBoundingClientRect = vi.fn(() => ({
    bottom: rect.top + rect.height,
    height: rect.height,
    left: 0,
    right: 100,
    top: rect.top,
    width: 100,
    x: 0,
    y: rect.top,
    toJSON: () => ({}),
  }));
}

function makeElements({
  pinHeight = 100,
  stageHeight = 500,
  stageTop = 0,
  trackHeight = 1_100,
  trackTop = 100,
}: Partial<{
  pinHeight: number;
  stageHeight: number;
  stageTop: number;
  trackHeight: number;
  trackTop: number;
}> = {}) {
  const track = document.createElement("div");
  const pin = document.createElement("div");
  const stage = document.createElement("div");
  const trackRect = { height: trackHeight, top: trackTop };
  const pinRect = { height: pinHeight, top: 100 };
  const stageRect = { height: stageHeight, top: stageTop };

  installRect(track, trackRect);
  installRect(pin, pinRect);
  installRect(stage, stageRect);
  pin.append(stage);
  track.append(pin);
  document.body.append(track);

  return { pin, pinRect, stage, stageRect, track, trackRect };
}

describe("mountHomeScrollBinding", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    setVisibility("visible");
    setViewportHeight(1_000);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps sticky geometry through endpoints and midpoint and reverses on upward scroll", () => {
    const frames = installAnimationFrames();
    const { pin, stage, track, trackRect } = makeElements();
    pin.style.position = "sticky";
    pin.style.top = "100px";
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    expect(onProgress).toHaveBeenLastCalledWith(0);
    expect(track.dataset.homeScrollReady).toBe("true");

    trackRect.top = -400;
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(frames.pending()).toBe(1);
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(0.5);

    trackRect.top = -900;
    window.dispatchEvent(new Event("scroll"));
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(1);

    trackRect.top = -150;
    window.dispatchEvent(new Event("scroll"));
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(0.25);

    trackRect.top = 900;
    binding.refresh();
    expect(onProgress).toHaveBeenLastCalledWith(0);
    trackRect.top = -9_000;
    binding.refresh();
    expect(onProgress).toHaveBeenLastCalledWith(1);
    binding.dispose();
  });

  it("maps chapter positions independently of a navigation bar outside the measured range", () => {
    installAnimationFrames();
    const { pin, stage, track } = makeElements({ trackTop: 40, trackHeight: 1160 });
    const range = document.createElement('div');
    const rangeRect = { top: 100, height: 1100 };
    installRect(range, rangeRect);
    track.append(range);
    range.append(pin);
    pin.style.position = 'sticky';
    pin.style.top = '100px';
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ stage, track, pin, range, onProgress });
    expect(onProgress).toHaveBeenLastCalledWith(0);
    rangeRect.top = -400; binding.refresh();
    expect(onProgress).toHaveBeenLastCalledWith(0.5);
    rangeRect.top = -900; binding.refresh();
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(track.dataset.homeScrollReady).toBe('true');
    binding.dispose();
  });

  it("uses the stage passage through the viewport when the pin is in natural flow", () => {
    const frames = installAnimationFrames();
    const { pin, stage, stageRect, track } = makeElements({ stageTop: 800 });
    pin.style.position = "relative";
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    expect(onProgress).toHaveBeenLastCalledWith(0);
    stageRect.top = 300;
    window.dispatchEvent(new Event("scroll"));
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(0.5);
    stageRect.top = -200;
    window.dispatchEvent(new Event("scroll"));
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(1);

    binding.dispose();
  });

  it("recomputes changed geometry after observed and window resizes", () => {
    const frames = installAnimationFrames();
    const { pin, stage, track, trackRect } = makeElements({ trackTop: -400 });
    pin.style.position = "sticky";
    pin.style.top = "100px";
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });
    const observer = MockResizeObserver.instances[0];

    expect(onProgress).toHaveBeenLastCalledWith(0.5);
    expect(observer?.observe.mock.calls.map(([element]) => element)).toEqual([
      stage,
      track,
      pin,
    ]);

    trackRect.height = 2_100;
    observer?.trigger();
    observer?.trigger();
    expect(frames.pending()).toBe(1);
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(0.25);

    trackRect.height = 3_100;
    window.dispatchEvent(new Event("resize"));
    frames.flush();
    expect(onProgress).toHaveBeenLastCalledWith(1 / 6);
    binding.dispose();
  });

  it("synchronizes an initial deep-scroll position immediately without requesting a frame", () => {
    const frames = installAnimationFrames();
    const { pin, stage, track } = makeElements({ stageTop: 50 });
    pin.style.position = "static";
    const onProgress = vi.fn();

    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenLastCalledWith(0.75);
    expect(track.dataset.homeScrollProgress).toBe("0.75");
    expect(track.style.getPropertyValue("--home-scroll-progress")).toBe("0.75");
    expect(frames.request).not.toHaveBeenCalled();
    binding.dispose();
  });

  it("does no hidden-document work and refreshes immediately when visibility returns", () => {
    const frames = installAnimationFrames();
    const { pin, stage, stageRect, track } = makeElements({ stageTop: 800 });
    pin.style.position = "static";
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    stageRect.top = 300;
    window.dispatchEvent(new Event("scroll"));
    expect(frames.pending()).toBe(1);
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.pending()).toBe(0);
    expect(frames.cancel).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    MockResizeObserver.instances[0]?.trigger();
    binding.refresh();
    expect(frames.pending()).toBe(0);
    expect(onProgress).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(0.5);
    expect(frames.pending()).toBe(0);
    binding.dispose();
  });

  it("restores prior attributes and styles, disconnects, and cancels pending work", () => {
    const frames = installAnimationFrames();
    const { pin, stage, track } = makeElements({ stageTop: 800 });
    pin.style.position = "static";
    track.setAttribute("data-home-scroll-ready", "parent-ready");
    track.setAttribute("data-home-scroll-progress", "parent-progress");
    track.style.setProperty("--home-scroll-progress", "parent-value", "important");
    const onProgress = vi.fn();
    const addEventListener = vi.spyOn(window, "addEventListener");
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });
    const observer = MockResizeObserver.instances[0];

    expect(addEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), {
      passive: true,
    });
    window.dispatchEvent(new Event("scroll"));
    expect(frames.pending()).toBe(1);
    binding.dispose();

    expect(frames.pending()).toBe(0);
    expect(frames.cancel).toHaveBeenCalledTimes(1);
    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
    expect(track.getAttribute("data-home-scroll-ready")).toBe("parent-ready");
    expect(track.getAttribute("data-home-scroll-progress")).toBe("parent-progress");
    expect(track.style.getPropertyValue("--home-scroll-progress")).toBe("parent-value");
    expect(track.style.getPropertyPriority("--home-scroll-progress")).toBe("important");

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
    observer?.trigger();
    binding.refresh();
    binding.dispose();
    expect(frames.pending()).toBe(0);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it("removes binding-owned metadata when no prior values existed", () => {
    installAnimationFrames();
    const { pin, stage, track } = makeElements();
    pin.style.position = "static";
    const binding = mountHomeScrollBinding({
      onProgress: vi.fn(),
      pin,
      stage,
      track,
    });

    binding.dispose();

    expect(track.hasAttribute("data-home-scroll-ready")).toBe(false);
    expect(track.hasAttribute("data-home-scroll-progress")).toBe(false);
    expect(track.style.getPropertyValue("--home-scroll-progress")).toBe("");
  });

  it("handles a missing ResizeObserver and clamps invalid or degenerate geometry", () => {
    installAnimationFrames();
    vi.stubGlobal("ResizeObserver", undefined);
    const { pin, stage, track, trackRect } = makeElements({
      pinHeight: Number.POSITIVE_INFINITY,
      trackHeight: Number.NaN,
      trackTop: Number.NEGATIVE_INFINITY,
    });
    pin.style.position = "sticky";
    pin.style.top = "auto";
    const onProgress = vi.fn();

    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    expect(onProgress).toHaveBeenLastCalledWith(0);
    expect(track.dataset.homeScrollProgress).toBe("0");
    trackRect.height = 100;
    binding.refresh();
    expect(onProgress).toHaveBeenLastCalledWith(0);
    binding.dispose();
  });

  it("does not rewrite the CSS progress property when progress is unchanged", () => {
    installAnimationFrames();
    const { pin, stage, track } = makeElements({ stageTop: 300 });
    pin.style.position = "static";
    const setProperty = vi.spyOn(track.style, "setProperty");
    const onProgress = vi.fn();
    const binding = mountHomeScrollBinding({ onProgress, pin, stage, track });

    binding.refresh();
    binding.refresh();

    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith("--home-scroll-progress", "0.5");
    expect(onProgress).toHaveBeenCalledTimes(3);
    binding.dispose();
  });
});
