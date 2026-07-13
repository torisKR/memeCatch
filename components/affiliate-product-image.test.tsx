// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateProductImage } from "@/components/affiliate-product-image";

describe("AffiliateProductImage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("preserves the 4:3 frame and shows a decorative fallback after an image error", () => {
    const { container } = render(
      <AffiliateProductImage
        imageUrl="https://img.podgate.com/product.jpg"
        productName="테스트 상품"
      />,
    );
    const frame = container.querySelector('[data-slot="affiliate-product-image"]');
    const image = screen.getByRole("img", { name: "테스트 상품" });

    expect(frame?.className).toContain("aspect-[4/3]");
    fireEvent.error(image);

    expect(screen.queryByRole("img", { name: "테스트 상품" })).toBeNull();
    expect(screen.getByText("MemeCatch pick").getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(frame?.isConnected).toBe(true);
    expect(frame?.className).toContain("aspect-[4/3]");
  });

  it("detects an already-complete broken image when the client ref attaches", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);

    const { container } = render(
      <AffiliateProductImage
        imageUrl="https://img.podgate.com/pre-hydration-broken.jpg"
        productName="로드 전 깨진 상품"
      />,
    );

    expect(
      screen.queryByRole("img", { name: "로드 전 깨진 상품" }),
    ).toBeNull();
    expect(screen.getByText("MemeCatch pick")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="affiliate-product-image"]')
        ?.className,
    ).toContain("aspect-[4/3]");
  });

  it("renders a different URL after the previous URL failed", () => {
    const { rerender } = render(
      <AffiliateProductImage
        imageUrl="https://img.podgate.com/broken-a.jpg"
        productName="교체 상품"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "교체 상품" }));
    expect(screen.queryByRole("img", { name: "교체 상품" })).toBeNull();

    rerender(
      <AffiliateProductImage
        imageUrl="https://img.podgate.com/valid-b.jpg"
        productName="교체 상품"
      />,
    );

    expect(
      screen.getByRole("img", { name: "교체 상품" }).getAttribute("src"),
    ).toBe("https://img.podgate.com/valid-b.jpg");
  });
});
