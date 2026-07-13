import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorialProductCard } from "@/components/editorial-product-card";
import type { MemeProduct } from "@/lib/meme-commerce";
import { PAGE_COPY } from "@/lib/i18n-pages";

const product: MemeProduct = {
  id: "editor-pick",
  title: "에디터 추천 상품",
  description: "편집자가 선택한 이유입니다.",
  category: "패션",
  audiences: ["20s", "30s"],
  provider: "adpick",
  status: "approved",
  destinationUrl: "https://deg.kr/editor-pick",
  sourceUrl: "https://adpick.co.kr/?ac=offer&offer=editor-pick",
  disclosure: "광고: 이 링크를 통해 수수료를 받을 수 있습니다.",
  approvedAt: "2026-07-01",
  expiresAt: "2099-07-19",
};

describe("EditorialProductCard", () => {
  it("labels and localizes an active editor pick without hiding its affiliate relationship", () => {
    const html = renderToStaticMarkup(
      <EditorialProductCard locale="ko" product={product} />,
    );

    expect(html).toContain(PAGE_COPY.ko.editorBadge);
    expect(html).toContain(product.title);
    expect(html).toContain(product.disclosure);
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).toContain(
      `aria-label="${PAGE_COPY.ko.checkProductLabel(product.title)}"`,
    );
  });

  it("does not render an active campaign CTA after expiry", () => {
    const html = renderToStaticMarkup(
      <EditorialProductCard
        locale="ko"
        product={{ ...product, expiresAt: "2020-01-01" }}
      />,
    );

    expect(html).toContain(PAGE_COPY.ko.ended);
    expect(html).not.toContain('href="https://deg.kr/editor-pick"');
    expect(html).not.toContain(
      `aria-label="${PAGE_COPY.ko.checkProductLabel(product.title)}"`,
    );
  });
});
