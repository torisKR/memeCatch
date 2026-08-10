import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "ja", messages: getMessages("ja") }) };
});

import {
  MemeTrendPanel,
  trendPanelUpgradeHref,
} from "@/components/premium/meme-trend-panel";

describe("MemeTrendPanel", () => {
  it("renders its Plus label in the active locale before loading private metrics", () => {
    const html = renderToStaticMarkup(<MemeTrendPanel memeId="meme-1" />);

    expect(html).toContain("トレンド推移");
    expect(html).toContain("Plus");
    expect(html).not.toContain("트렌드 추이");
  });

  it("returns a signed-out visitor to the same localized Plus page after login", () => {
    expect(trendPanelUpgradeHref("signed_out", "ja")).toBe(
      "/login?next=%2Fja%2Fpricing",
    );
    expect(trendPanelUpgradeHref("not_premium", "zh-tw")).toBe(
      "/zh-tw/pricing",
    );
  });
});
