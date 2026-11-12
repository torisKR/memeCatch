// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SafetyLevel } from "@/lib/labels";
import { HOME_SCENE_COPY } from "@/lib/home-scene-copy";

type MockRendererOptions = {
  maxPixelRatio?: number;
  layoutMode?: "stacked" | "spread";
  onContextLost?: () => void;
  onSignalSelect?: (level: SafetyLevel) => void;
  paused?: boolean;
  selectedSignal?: SafetyLevel;
};

const rendererController = {
  dispose: vi.fn(),
  resetView: vi.fn(),
  setPaused: vi.fn(),
  setSelectedSignal: vi.fn(),
  setLayoutMode: vi.fn(),
  setScrollProgress: vi.fn(),
};

const scrollBinding = vi.hoisted(() => ({
  progress: 0.35,
  callbacks: [] as Array<(progress: number) => void>,
  dispose: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/components/home/home-scroll-binding", () => ({
  mountHomeScrollBinding: ({ onProgress }: { onProgress: (value: number) => void }) => {
    scrollBinding.callbacks.push(onProgress);
    onProgress(scrollBinding.progress);
    scrollBinding.refresh.mockImplementation(() => onProgress(scrollBinding.progress));
    return { refresh: scrollBinding.refresh, dispose: scrollBinding.dispose };
  },
}));

const mountHomeScene = vi.fn<(
  host: HTMLElement,
  options: MockRendererOptions,
) => typeof rendererController>(() => rendererController);

vi.mock("@/components/home/home-scene-renderer", () => ({
  mountHomeScene,
}));

import { HomeScene } from "@/components/home/home-scene";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) {
    MockIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function mockMediaQuery(matches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
  return {
    mediaQuery,
    emit(nextMatches: boolean) {
      Object.defineProperty(mediaQuery, "matches", {
        configurable: true,
        value: nextMatches,
      });
      const event = { matches: nextMatches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function allowWebGl() {
  return vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation((contextId: string) => (
      contextId === "webgl2" || contextId === "webgl"
        ? ({} as WebGLRenderingContext)
        : null
    ) as never);
}

describe("HomeScene", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    scrollBinding.callbacks = [];
    scrollBinding.progress = 0.35;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    mockMediaQuery();
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false },
    });
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: 8,
    });
    allowWebGl();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a full-scene story without the former boxed control dashboard", () => {
    const html = renderToStaticMarkup(<HomeScene locale="en" variant="story" />);
    expect(html).toContain('data-scene-variant="story"');
    expect(html).toContain('data-story-scene="true"');
    expect(html.match(/data-home-scene-stage=/g)).toHaveLength(1);
    expect(html).toContain('data-story-controls="true"');
    expect(html).toContain("Scene controls");
    expect(html).not.toContain('<details open');
    expect(html.match(/data-scene-signal=/g)).toHaveLength(4);
    expect(html.match(/data-scene-layout=/g)).toHaveLength(3);
    expect(html).not.toContain('<canvas');
  });

  it("binds one story renderer to the whole chapter track and preserves pause and disclosure access", async () => {
    const user = userEvent.setup();
    const { container } = render(<section data-home-scroll-track><div data-home-scroll-pin><HomeScene locale="en" variant="story" /></div></section>);
    expect(MockIntersectionObserver.instances[0]?.options?.rootMargin).toBe('0px');
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    expect(mountHomeScene.mock.calls.at(-1)?.[1]).toMatchObject({ scrollProgress: 0.35 });
    act(() => scrollBinding.callbacks.at(-1)?.(0.8));
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.8);
    await user.click(screen.getByText("Scene controls"));
    const disclosure = container.querySelector('[data-story-controls]');
    expect(disclosure?.hasAttribute('open')).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'Spread' }));
    expect(rendererController.setLayoutMode).toHaveBeenLastCalledWith('spread');
    await user.click(screen.getByRole('button', { name: 'Pause artwork' }));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);
    await user.keyboard('{Escape}');
    expect(disclosure?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(disclosure?.querySelector('summary'));
    expect(mountHomeScene).toHaveBeenCalledTimes(1);
  });

  it("retains an already-visible story layout on GPU loss and releases it at unmount", async () => {
    const { container, unmount } = render(<section data-home-scroll-track><div data-home-scroll-pin><HomeScene locale="en" variant="story" /></div></section>);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    const track = container.querySelector('[data-home-scroll-track]')!;
    act(() => mountHomeScene.mock.calls.at(-1)?.[1].onContextLost?.());
    expect(track.getAttribute('data-home-scroll-retained')).toBe('true');
    expect(container.querySelector('figure')?.dataset.renderer).toBe('failed');
    expect(scrollBinding.dispose).toHaveBeenCalled();
    expect(container.querySelector('[data-home-scene-fallback]')).not.toBeNull();
    unmount();
    expect(track.hasAttribute('data-home-scroll-retained')).toBe(false);
  });

  it("offers an integrated hero variant with one stage and accessible controls in initial HTML", () => {
    const html = renderToStaticMarkup(<HomeScene locale="en" variant="hero" />);
    expect(html).toContain('data-scene-variant="hero"');
    expect(html.match(/data-home-scene-stage=/g)).toHaveLength(1);
    expect(html.match(/data-scene-signal=/g)).toHaveLength(4);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Safe to use");
    expect(html).toContain("Education only. Not a verdict on any meme.");
    expect(html).toContain('data-home-scene-fallback="true"');
    expect(html).not.toContain('<canvas');
  });

  it("starts the shared hero in reversible scroll mode and releases it for manual layouts", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <section data-home-scroll-track><div data-home-scroll-pin><HomeScene locale="en" variant="hero" /></div></section>,
    );
    const scroll = screen.getByRole("radio", { name: "Scroll" }) as HTMLInputElement;
    expect(scroll.checked).toBe(true);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.35));
    expect(mountHomeScene.mock.calls.at(-1)?.[1]).toMatchObject({ scrollProgress: 0.35 });
    act(() => scrollBinding.callbacks.at(-1)?.(0.8));
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.8);
    expect(container.querySelector("[data-scene-scroll-cue]")?.getAttribute("data-phase")).toBe("2");
    await user.click(screen.getByRole("radio", { name: "Spread" }));
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(null);
    expect(rendererController.setLayoutMode).toHaveBeenLastCalledWith("spread");
    const calls = rendererController.setScrollProgress.mock.calls.length;
    act(() => scrollBinding.callbacks.at(-1)?.(0.2));
    expect(rendererController.setScrollProgress).toHaveBeenCalledTimes(calls);
    scrollBinding.progress = 0.2;
    await user.click(scroll);
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.2);
    unmount();
    expect(scrollBinding.dispose).toHaveBeenCalled();
  });

  it("freezes scroll updates during pause and reduced motion and resyncs on play", async () => {
    const user = userEvent.setup();
    const motion = mockMediaQuery();
    render(<section data-home-scroll-track><div data-home-scroll-pin><HomeScene locale="en" variant="hero" /></div></section>);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(rendererController.setScrollProgress).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Pause artwork" }));
    const pausedCalls = rendererController.setScrollProgress.mock.calls.length;
    scrollBinding.progress = 0.7;
    act(() => scrollBinding.callbacks.at(-1)?.(0.7));
    expect(rendererController.setScrollProgress).toHaveBeenCalledTimes(pausedCalls);
    await user.click(screen.getByRole("button", { name: "Play artwork" }));
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.7);
    act(() => motion.emit(true));
    const reducedCalls = rendererController.setScrollProgress.mock.calls.length;
    act(() => scrollBinding.callbacks.at(-1)?.(0.95));
    expect(rendererController.setScrollProgress).toHaveBeenCalledTimes(reducedCalls);
    expect(screen.getByText(/Scroll motion is off/)).toBeTruthy();
    act(() => motion.emit(false));
    expect(rendererController.setScrollProgress).toHaveBeenLastCalledWith(0.7);
  });

  it("explains a terminal static hero instead of advertising endless loading", async () => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    const { container } = render(<HomeScene locale="en" variant="hero" />);
    await waitFor(() => expect(container.querySelector('figure')?.dataset.renderer).toBe('static'));
    expect(container.querySelector('[data-scene-scroll-cue]')?.textContent).not.toContain('Loading 3D');
    expect(container.querySelector('[data-scene-scroll-cue]')?.textContent).toContain(HOME_SCENE_COPY.en.layoutUnavailable);
  });

  it("keeps the standalone studio variant as the backward-compatible default", () => {
    const html = renderToStaticMarkup(<HomeScene />);
    expect(html).toContain('data-scene-variant="studio"');
  });

  it("switches real layout modes without remounting the renderer or losing signal selection", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeScene locale="en" />);
    expect((screen.getByRole("radio", { name: "Spread" }) as HTMLInputElement).disabled).toBe(true);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Check the context" }));
    await user.click(screen.getByRole("radio", { name: "Spread" }));
    expect(rendererController.setLayoutMode).toHaveBeenLastCalledWith("spread");
    expect((screen.getByRole("radio", { name: "Spread" }) as HTMLInputElement).checked).toBe(true);
    expect(container.querySelector("figure")?.getAttribute("data-layout-mode")).toBe("spread");
    expect(screen.getByRole("button", { name: "Check the context" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Reset view" }));
    expect(mountHomeScene).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("radio", { name: "Spread" }) as HTMLInputElement).checked).toBe(true);
    act(() => mountHomeScene.mock.calls[0]?.[1].onContextLost?.());
    expect((screen.getByRole("radio", { name: "Stack" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Spread" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Check the context" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("server-renders the artwork and a localized interactive explanation", () => {
    const html = renderToStaticMarkup(
      <HomeScene className="scene-slot" label="Catch the signal" locale="en" />,
    );

    expect(html).toContain("scene-slot");
    expect(html).toContain("Catch the signal");
    expect(html).toContain('data-home-scene-stage="true"');
    expect(html).toContain("h-64");
    expect(html).toContain("sm:h-[340px]");
    expect(html).toContain("lg:h-[390px]");
    expect(html).toContain('data-scene-backplate="true"');
    expect(html).toContain('data-scene-ambient="true"');
    expect(html).toContain('data-scene-brand="true"');
    expect(html).toMatch(/aria-hidden="true"[^>]*>CATCH<\/span>/);
    expect(html).toContain('data-home-scene-fallback="true"');
    expect(html.match(/transition-opacity duration-300 motion-reduce:transition-none/g)).toHaveLength(2);
    expect(html.match(/data-signal-token=/g)).toHaveLength(4);
    expect(html.match(/aria-pressed=/g)).toHaveLength(4);
    expect(html.match(/data-scene-signal=/g)).toHaveLength(4);
    expect(html).toContain('data-scene-reset="true"');
    expect(html).toContain('data-scene-control-dock="true"');
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("MemeCatch Studio");
    expect(html).not.toContain("Choose a signal to explore its context");
    expect(html).toContain("educational demo");
    expect(html).toContain("Reviewed examples generally land without harmful meaning");
    expect(html).toContain('aria-live="polite"');
    expect(html).toMatch(/<summary[\s\S]*?Education only\. Not a verdict on any meme\.[\s\S]*?<\/summary>/);
    expect(html).toContain("Why this signal?");
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).not.toContain("<details open");

    const glyphs = [...html.matchAll(/data-signal-glyph="([^"]+)"/g)].map(
      ([, glyph]) => glyph,
    );
    expect(new Set(glyphs)).toEqual(
      new Set(["check", "context", "clock", "stop"]),
    );
  });

  it("keeps fallback signal selection useful and skips GPU setup when data saving is enabled", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });

    const user = userEvent.setup();
    const { container } = render(<HomeScene label="Catch the signal" locale="en" />);

    await waitFor(() => {
      expect(container.firstElementChild?.getAttribute("data-renderer")).toBe("static");
    });
    expect(mountHomeScene).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Check the context" }));
    expect(screen.getByRole("button", { name: "Check the context" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-home-scene-fallback]")?.getAttribute("data-selected-signal")).toBe("yellow");
    expect(screen.getByRole("status").textContent).toContain("Audience and setting can change the meaning");
    expect(screen.getByRole("status").textContent).not.toContain("The phrase can be misunderstood");
    const guidance = screen.getByText("Why this signal?").closest("details");
    expect(guidance?.hasAttribute("open")).toBe(false);
    expect(guidance?.textContent).toContain("The phrase can be misunderstood");
    await user.click(screen.getByText("Why this signal?"));
    expect(guidance?.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("button", { name: "Reset view" }).getAttribute("data-scene-reset")).toBe("true");
    expect((screen.getByRole("button", { name: "Reset view" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps selection made before lazy import and passes it into the renderer", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeScene locale="en" />);
    const group = screen.getByRole("group", { name: "Explore usage signals" });

    expect(within(group).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Safe to use" }).getAttribute("data-scene-signal")).toBe("green");
    expect(screen.getByRole("button", { name: "Safe to use" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Past its moment" }));

    expect(mountHomeScene).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Past its moment" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-home-scene-fallback]")?.getAttribute("data-selected-signal")).toBe("gray");

    act(() => MockIntersectionObserver.instances[0]?.trigger(true));

    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    expect(mountHomeScene.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      selectedSignal: "gray",
      onSignalSelect: expect.any(Function),
    }));
  });

  it("synchronizes HTML controls with renderer clicks and raycast callbacks", async () => {
    const user = userEvent.setup();
    render(<HomeScene locale="en" />);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Check the context" }));
    expect(rendererController.setSelectedSignal).toHaveBeenLastCalledWith("yellow");
    expect(screen.getByRole("button", { name: "Check the context" }).getAttribute("aria-pressed")).toBe("true");

    act(() => mountHomeScene.mock.calls[0]?.[1].onSignalSelect?.("red"));

    expect(screen.getByRole("button", { name: "Risky to use" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Linked to harmful or contentious use");
    expect(screen.getByText("Why this signal?").closest("details")?.textContent).toContain("Reviewed examples include derogatory");
    expect(rendererController.setSelectedSignal).toHaveBeenCalledTimes(1);
  });

  it("supports native keyboard selection and resetting the 3D view", async () => {
    const user = userEvent.setup();
    render(<HomeScene locale="en" />);
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));

    const lateSignal = screen.getByRole("button", { name: "Past its moment" });
    lateSignal.focus();
    await user.keyboard("{Enter}");
    expect(lateSignal.getAttribute("aria-pressed")).toBe("true");
    expect(rendererController.setSelectedSignal).toHaveBeenLastCalledWith("gray");

    const resetButton = screen.getByRole("button", { name: "Reset view" });
    resetButton.focus();
    await user.keyboard("{Enter}");
    expect(rendererController.resetView).toHaveBeenCalledTimes(1);
  });

  it("defers GPU mounting until visible and coordinates pause, tab, loss, and cleanup", async () => {
    const visibilityState = vi.spyOn(document, "visibilityState", "get");
    visibilityState.mockReturnValue("visible");

    const { container, unmount } = render(
      <HomeScene
        label="Catch the signal"
        pauseLabel="Pause artwork"
        playLabel="Play artwork"
      />,
    );

    expect(mountHomeScene).not.toHaveBeenCalled();

    act(() => MockIntersectionObserver.instances[0]?.trigger(true));

    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    expect(container.firstElementChild?.getAttribute("data-renderer")).toBe("ready");
    expect(mountHomeScene).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        maxPixelRatio: 1.5,
        selectedSignal: "green",
        onSignalSelect: expect.any(Function),
        paused: false,
        onContextLost: expect.any(Function),
      }),
    );

    act(() => MockIntersectionObserver.instances[0]?.trigger(false));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);

    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(false);

    visibilityState.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);

    visibilityState.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(false);

    const playbackButton = screen.getByRole("button", { name: "Pause artwork" });
    expect(playbackButton.getAttribute("data-scene-playback")).toBe("true");
    expect(playbackButton.hasAttribute("aria-pressed")).toBe(false);
    fireEvent.click(playbackButton);
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Play artwork" }));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(false);

    const options = mountHomeScene.mock.calls[0]?.[1];
    act(() => options?.onContextLost?.());
    expect(container.firstElementChild?.getAttribute("data-renderer")).toBe("failed");
    expect(screen.queryByRole("button", { name: "Pause artwork" })).toBeNull();
    expect(screen.getByRole("button", { name: "써도 됨" })).toBeDefined();

    unmount();
    expect(rendererController.dispose).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it("tracks reduced motion independently and resumes only without an explicit user pause", async () => {
    const motionPreference = mockMediaQuery(false);
    render(
      <HomeScene
        label="Catch the signal"
        pauseLabel="Pause artwork"
        playLabel="Play artwork"
      />,
    );

    act(() => MockIntersectionObserver.instances[0]?.trigger(true));

    await waitFor(() => expect(mountHomeScene).toHaveBeenCalledTimes(1));
    expect(mountHomeScene.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ paused: false }),
    );

    act(() => motionPreference.emit(true));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Play artwork" })).toBeDefined();

    act(() => motionPreference.emit(false));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Pause artwork" }));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);

    act(() => motionPreference.emit(true));
    act(() => motionPreference.emit(false));
    expect(rendererController.setPaused).toHaveBeenLastCalledWith(true);
  });

  it("keeps the unfinished Korean 3D status and its layout controls out of the initial story HTML", () => {
    const html = renderToStaticMarkup(<HomeScene locale="ko" variant="story" />);
    expect(html).not.toContain("3D 준비 중");
    expect(html).not.toContain("준비 중");
    expect(html).not.toContain("data-scene-layout=");
    expect(html).not.toContain("data-scene-reset=");
    expect(html).toContain('data-scene-signal="green"');
  });

  it("shows Korean layout controls after the renderer is ready, without a preparing label", async () => {
    const { container } = render(
      <section data-home-scroll-track>
        <div data-home-scroll-pin>
          <HomeScene locale="ko" variant="story" />
        </div>
      </section>,
    );
    expect(container.innerHTML).not.toContain("3D 준비 중");
    act(() => MockIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(mountHomeScene).toHaveBeenCalled());
    expect(container.querySelectorAll("[data-scene-layout]")).toHaveLength(3);
    expect(container.innerHTML).not.toContain("3D 준비 중");
    expect(container.innerHTML).not.toContain("준비 중");
  });
});
