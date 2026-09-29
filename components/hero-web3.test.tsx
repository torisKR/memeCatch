import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { HeroWeb3 } from "@/components/hero-web3";

describe("HeroWeb3", () => {
  it("uses the optimized brand signal art at its intrinsic aspect ratio with a WebP fallback", () => {
    const html = renderToStaticMarkup(<HeroWeb3 totalCount={42} />);

    expect(html).toContain('type="image/avif" srcSet="/brand/hero-signal-v2.avif"');
    expect(html).toContain('type="image/webp" srcSet="/brand/hero-signal-v2.webp"');
    expect(html).toContain('src="/brand/hero-signal-v2.webp"');
    expect(html).toContain('width="2752" height="1536"');
    expect(html).toContain("aspect-[2752/1536]");
    expect(html).toContain("42");
    expect(html).not.toContain("무료 활용 문구");
  });
});
