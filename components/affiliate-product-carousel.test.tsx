// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AffiliateProductCarousel } from "@/components/affiliate-product-carousel";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import { PAGE_COPY } from "@/lib/i18n-pages";

const mocks = vi.hoisted(() => {
  let reduceMotion = false;
  let playing = false;
  let pluginPlayCalls: number[] = [];
  let currentApi:
    | {
        emit: (event: string) => unknown;
        off: (event: string, callback: () => void) => unknown;
        on: (event: string, callback: () => void) => unknown;
      }
    | undefined;
  let currentPlugin:
    | {
        destroy: () => void;
        init: (api: NonNullable<typeof currentApi>) => void;
        play: () => void;
      }
    | undefined;

  return {
    autoScrollFactory: vi.fn(),
    autoScrollPlay: vi.fn(),
    autoScrollStop: vi.fn(),
    autoScrollIsPlaying: vi.fn(() => playing),
    emitReInit: () => {
      if (!currentApi || !currentPlugin) return;
      currentPlugin.destroy();
      currentPlugin.init(currentApi);
      currentApi.emit("reInit");
    },
    emitPointerDown: () => currentApi?.emit("pointerDown"),
    emitPointerUp: () => currentApi?.emit("pointerUp"),
    emitSettle: () => currentApi?.emit("settle"),
    getReduceMotion: () => reduceMotion,
    getPluginPlayCalls: (index: number) => pluginPlayCalls[index] ?? 0,
    latestPluginIndex: () => pluginPlayCalls.length - 1,
    independentPlay: () => currentPlugin?.play(),
    recordPluginPlay: (index: number) => {
      pluginPlayCalls[index] += 1;
    },
    registerPlugin: () => {
      pluginPlayCalls.push(0);
      return pluginPlayCalls.length - 1;
    },
    resetController: () => {
      currentApi = undefined;
      currentPlugin = undefined;
      playing = false;
      pluginPlayCalls = [];
    },
    setReduceMotion: (value: boolean) => {
      reduceMotion = value;
    },
    setCurrentApi: (api: NonNullable<typeof currentApi>) => {
      currentApi = api;
    },
    setCurrentPlugin: (plugin: NonNullable<typeof currentPlugin>) => {
      currentPlugin = plugin;
    },
    setPlaying: (value: boolean) => {
      playing = value;
    },
  };
});

vi.mock("motion/react", () => ({
  useReducedMotion: () => mocks.getReduceMotion(),
}));

vi.mock("embla-carousel-auto-scroll", () => ({
  default: (options: Record<string, unknown>) => {
    mocks.autoScrollFactory(options);
    const pluginIndex = mocks.registerPlugin();
    let api:
      | {
          emit: (event: string) => unknown;
          off: (event: string, callback: () => void) => unknown;
          on: (event: string, callback: () => void) => unknown;
        }
      | undefined;
    let destroyed = false;

    const play = vi.fn(() => {
      if (destroyed || mocks.autoScrollIsPlaying()) return;
      mocks.recordPluginPlay(pluginIndex);
      mocks.autoScrollPlay();
      api?.emit("autoScroll:play");
      mocks.setPlaying(true);
    });
    const stop = vi.fn(() => {
      if (destroyed || !mocks.autoScrollIsPlaying()) return;
      mocks.autoScrollStop();
      api?.emit("autoScroll:stop");
      mocks.setPlaying(false);
    });
    const settle = () => {
      api?.off("settle", settle);
      play();
    };
    const pointerDown = () => stop();
    const pointerUp = () => api?.on("settle", settle);

    const plugin = {
      name: "autoScroll",
      options: {
        active: true,
        breakpoints: {},
        ...options,
      },
      init: (nextApi: NonNullable<typeof api>) => {
        api = nextApi;
        destroyed = false;
        mocks.setCurrentApi(nextApi);
        nextApi.on("pointerDown", pointerDown);
        nextApi.on("pointerUp", pointerUp);
        if (options.playOnInit) play();
      },
      destroy: () => {
        if (!api) return;
        api.off("pointerDown", pointerDown);
        api.off("pointerUp", pointerUp);
        api.off("settle", settle);
        stop();
        destroyed = true;
      },
      play,
      stop,
      reset: vi.fn(),
      isPlaying: mocks.autoScrollIsPlaying,
    };

    mocks.setCurrentPlugin(plugin);

    return plugin;
  },
}));

const product: AffiliateStorefrontProduct = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  provider: "adpick",
  sourceType: "hotdeal",
  externalKey: "product-key",
  themeCode: "20",
  themeTitle: "실시간 핫딜",
  themeDescription: "현재 판매 가능한 상품",
  sourceRank: 0,
  productName: "테스트 상품",
  imageUrl: null,
  mallDomain: "shop.example.com",
  mallName: "테스트몰",
  mallIconUrl: null,
  salePrice: 12900,
  originalPrice: 25800,
  clickCount7d: 3,
};

function products(count: number): AffiliateStorefrontProduct[] {
  return Array.from({ length: count }, (_, index) => ({
    ...product,
    id: `${product.id.slice(0, -1)}${index}`,
    productName: `${product.productName} ${index + 1}`,
    sourceRank: index,
  }));
}

function renderCarousel(
  overrides: Partial<ComponentProps<typeof AffiliateProductCarousel>> = {},
) {
  return render(
    <AffiliateProductCarousel
      products={products(4)}
      locale="ko"
      sectionId="hotdeal-products"
      {...overrides}
    />,
  );
}

describe("AffiliateProductCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetController();
    mocks.setReduceMotion(false);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders translated controls and lets the shopper pause auto-scroll", async () => {
    const user = userEvent.setup();
    renderCarousel();

    expect(
      screen.getByRole("region", { name: PAGE_COPY.ko.carouselLabel }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.previousProduct }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.nextProduct }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    );

    expect(mocks.autoScrollStop).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.playCarousel }),
    ).toBeTruthy();
  });

  it("stops while focus is inside and resumes after focus leaves", () => {
    renderCarousel();
    const region = screen.getByRole("region", {
      name: PAGE_COPY.ko.carouselLabel,
    });

    fireEvent.focusIn(region);
    expect(mocks.autoScrollStop).toHaveBeenCalled();

    fireEvent.focusOut(region, { relatedTarget: document.body });
    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(2);
  });

  it("treats a control click while hovered as an explicit pause", async () => {
    const user = userEvent.setup();
    renderCarousel();
    const region = screen.getByRole("region", {
      name: PAGE_COPY.ko.carouselLabel,
    });

    fireEvent.mouseEnter(region);
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    );
    fireEvent.mouseLeave(region);
    fireEvent.focusOut(region, { relatedTarget: document.body });
    await act(async () => {
      mocks.independentPlay();
      await Promise.resolve();
    });

    expect(mocks.autoScrollIsPlaying()).toBe(false);
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.playCarousel }),
    ).toBeTruthy();
  });

  it("keeps explicit pause across focus exit and visibility restoration", async () => {
    const user = userEvent.setup();
    const visibilityState = vi.spyOn(document, "visibilityState", "get");
    visibilityState.mockReturnValue("visible");
    renderCarousel();
    const region = screen.getByRole("region", {
      name: PAGE_COPY.ko.carouselLabel,
    });

    fireEvent.focusIn(region);
    await user.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    );
    fireEvent.focusOut(region, { relatedTarget: document.body });
    visibilityState.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibilityState.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      mocks.independentPlay();
      await Promise.resolve();
    });

    expect(mocks.autoScrollIsPlaying()).toBe(false);
    expect(
      screen.getByRole("button", { name: PAGE_COPY.ko.playCarousel }),
    ).toBeTruthy();
    visibilityState.mockRestore();
  });

  it("blocks the plugin focusout callback during internal focus transitions", async () => {
    renderCarousel();
    const previous = screen.getByRole("button", {
      name: PAGE_COPY.ko.previousProduct,
    });
    const next = screen.getByRole("button", {
      name: PAGE_COPY.ko.nextProduct,
    });

    fireEvent.focusIn(previous);
    fireEvent.focusOut(previous, { relatedTarget: next });
    fireEvent.focusIn(next, { relatedTarget: previous });
    await act(async () => {
      mocks.independentPlay();
      await Promise.resolve();
    });

    expect(mocks.autoScrollIsPlaying()).toBe(false);
  });

  it("stops for hidden tabs and resumes when the tab becomes visible", () => {
    renderCarousel();
    const visibilityState = vi.spyOn(document, "visibilityState", "get");

    visibilityState.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.autoScrollStop).toHaveBeenCalled();

    visibilityState.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(2);

    visibilityState.mockRestore();
  });

  it("stops play-on-init when the document is initially hidden", async () => {
    const visibilityState = vi.spyOn(document, "visibilityState", "get");
    visibilityState.mockReturnValue("hidden");

    renderCarousel();
    await act(async () => Promise.resolve());

    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(1);
    expect(mocks.autoScrollStop).toHaveBeenCalled();
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    visibilityState.mockRestore();
  });

  it("uses backward auto-scroll and gives manual navigation a 2500ms grace period", async () => {
    vi.useFakeTimers();
    renderCarousel();

    expect(mocks.autoScrollFactory).toHaveBeenCalledWith({
      direction: "backward",
      playOnInit: true,
      speed: 0.75,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    });

    fireEvent.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.nextProduct }),
    );
    expect(mocks.autoScrollStop).toHaveBeenCalled();
    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2499);
    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.autoScrollPlay).toHaveBeenCalledTimes(2);
  });

  it("gives ArrowLeft and ArrowRight navigation an exact 2500ms grace", async () => {
    vi.useFakeTimers();
    renderCarousel();
    const region = screen.getByRole("region", {
      name: PAGE_COPY.ko.carouselLabel,
    });

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    await vi.advanceTimersByTimeAsync(2499);
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.autoScrollIsPlaying()).toBe(true);

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.autoScrollIsPlaying()).toBe(true);
  });

  it("starts pointer navigation grace only after drag settle", async () => {
    vi.useFakeTimers();
    renderCarousel();

    act(() => {
      mocks.emitPointerDown();
      mocks.emitPointerUp();
    });
    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.autoScrollIsPlaying()).toBe(false);

    await act(async () => {
      mocks.emitSettle();
      await Promise.resolve();
    });
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    await vi.advanceTimersByTimeAsync(2499);
    expect(mocks.autoScrollIsPlaying()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.autoScrollIsPlaying()).toBe(true);
  });

  it("reconciles play-on-init when Embla reinitializes while paused or focused", async () => {
    const user = userEvent.setup();
    renderCarousel();
    const region = screen.getByRole("region", {
      name: PAGE_COPY.ko.carouselLabel,
    });

    await user.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    );
    await act(async () => {
      mocks.emitReInit();
      await Promise.resolve();
    });
    expect(mocks.autoScrollIsPlaying()).toBe(false);

    await user.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.playCarousel }),
    );
    fireEvent.focusIn(region);
    await act(async () => {
      mocks.emitReInit();
      await Promise.resolve();
    });
    expect(mocks.autoScrollIsPlaying()).toBe(false);
  });

  it("cancels grace callbacks when eligibility changes and on unmount", async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderCarousel();
    const initiallyEligiblePlugin = mocks.latestPluginIndex();

    fireEvent.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.nextProduct }),
    );
    rerender(
      <AffiliateProductCarousel
        products={products(2)}
        locale="ko"
        sectionId="hotdeal-products"
      />,
    );
    const oldPluginCallsAfterEligibilityChange =
      mocks.getPluginPlayCalls(initiallyEligiblePlugin);
    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.getPluginPlayCalls(initiallyEligiblePlugin)).toBe(
      oldPluginCallsAfterEligibilityChange,
    );

    rerender(
      <AffiliateProductCarousel
        products={products(4)}
        locale="ko"
        sectionId="hotdeal-products"
      />,
    );
    const reeligiblePlugin = mocks.latestPluginIndex();
    fireEvent.click(
      screen.getByRole("button", { name: PAGE_COPY.ko.nextProduct }),
    );
    const playCallsBeforeUnmount = mocks.getPluginPlayCalls(reeligiblePlugin);
    unmount();
    await vi.advanceTimersByTimeAsync(2500);
    expect(mocks.getPluginPlayCalls(reeligiblePlugin)).toBe(playCallsBeforeUnmount);
  });

  it("does not start auto-scroll when reduced motion is preferred", () => {
    mocks.setReduceMotion(true);
    renderCarousel();

    expect(mocks.autoScrollPlay).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    ).toBeNull();
  });

  it("keeps short product lists manual without a play/pause control", () => {
    renderCarousel({ products: products(2) });

    expect(mocks.autoScrollPlay).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: PAGE_COPY.ko.pauseCarousel }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: PAGE_COPY.ko.playCarousel }),
    ).toBeNull();
  });
});
