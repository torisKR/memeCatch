import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentUrlPreview } from "@/components/content-url-preview";
import { SUBMIT_COPY } from "@/lib/i18n-submit";

describe("ContentUrlPreview", () => {
  it("uses the supplied locale copy for its empty state", () => {
    const html = renderToStaticMarkup(
      <ContentUrlPreview url="" copy={SUBMIT_COPY.en.preview} />,
    );

    expect(html).toContain("Paste a YouTube");
    expect(html).not.toContain("붙이면");
  });

  it("uses the supplied locale copy for unsupported links", () => {
    const html = renderToStaticMarkup(
      <ContentUrlPreview
        url="https://example.com/source"
        copy={SUBMIT_COPY.ja.preview}
      />,
    );

    expect(html).toContain("一般の出典リンクも投稿できます");
    expect(html).not.toContain("일반 출처 링크");
  });
});
