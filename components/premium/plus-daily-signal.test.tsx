import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlusDailySignal } from "@/components/premium/plus-daily-signal";

const candidate = {
  id: "meme-1",
  shortId: "abc12345",
  slug: "hello-world",
  title: "Hello world",
  summary: "A reviewed summary.",
  usageNote: "Use it with close friends.",
  caution: "Do not target a real person.",
  shareReady: true,
  trendScore: 92,
  safetyLevel: "green" as const,
  source: "saved_rising" as const,
};

describe("PlusDailySignal", () => {
  it("renders the current saved signal with a locale-safe detail link", () => {
    const html = renderToStaticMarkup(
      <PlusDailySignal candidates={[candidate]} locale="en" />,
    );

    expect(html).toContain("Today’s Plus Signal");
    expect(html).toContain("Rising saved meme");
    expect(html).toContain("/en/memes/abc12345-hello-world");
    expect(html).toContain("Safety signal: lower risk");
    expect(html).toContain("Create share pack");
    expect(html).toContain('data-signal-count="1"');
  });

  it("does not expose a share action until the reviewed prose is complete", () => {
    const html = renderToStaticMarkup(
      <PlusDailySignal candidates={[{ ...candidate, shareReady: false }]} locale="en" />,
    );

    expect(html).not.toContain("Create share pack");
    expect(html).toContain("/en/memes/abc12345-hello-world");
  });

  it("states when no reviewed rising signal is available", () => {
    const html = renderToStaticMarkup(
      <PlusDailySignal candidates={[]} locale="ko" />,
    );

    expect(html).toContain("지금은 새 신호가 없어요");
    expect(html).toContain("검수된 콘텐츠 중 현재 급상승 조건");
    expect(html).toContain('data-signal-count="0"');
  });
});
