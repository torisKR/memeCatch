// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AffiliateProductImage } from "@/components/affiliate-product-image";

describe("AffiliateProductImage", () => {
  afterEach(cleanup);

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
});
