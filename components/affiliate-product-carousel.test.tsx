// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AffiliateProductCarousel } from "@/components/affiliate-product-carousel";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import { PAGE_COPY } from "@/lib/i18n-pages";

const mocks = vi.hoisted(() => {
  let reduceMotion = false;
  let playing = false;

  return {
    autoScrollFactory: vi.fn(),
    autoScrollPlay: vi.fn(() => {
      playing = true;
    }),
    autoScrollStop: vi.fn(() => {
      playing = false;
    }),
    autoScrollIsPlaying: vi.fn(() => playing),
    getReduceMotion: () => reduceMotion,
    setReduceMotion: (value: boolean) => {
      reduceMotion = value;
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

    return {
      name: "autoScroll",
      options: {
        active: true,
        breakpoints: {},
        ...options,
      },
      init: () => {
        if (options.playOnInit) mocks.autoScrollPlay();
      },
      destroy: () => undefined,
      play: mocks.autoScrollPlay,
      stop: mocks.autoScrollStop,
      reset: vi.fn(),
      isPlaying: mocks.autoScrollIsPlaying,
    };
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
    mocks.setReduceMotion(false);
    mocks.setPlaying(false);
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
