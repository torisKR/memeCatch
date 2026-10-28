import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeMarketPassport } from "@/components/meme-market-passport";

describe("MemeMarketPassport", () => {
  it("renders the origin, reviewed market facts, and locale-safe variants", () => {
    const html = renderToStaticMarkup(
      <MemeMarketPassport
        locale="en"
        passport={{
          origin: {
            memeId: "meme-1",
            marketCode: "KR",
            languageTag: "ko",
            role: "origin",
            localTitle: "Original meme",
            localAliases: [],
            usageNote: null,
            caution: null,
          },
          profiles: [
            {
              memeId: "meme-1",
              marketCode: "KR",
              languageTag: "ko",
              role: "origin",
              localTitle: "Original meme",
              localAliases: [],
              usageNote: null,
              caution: null,
            },
            {
              memeId: "meme-1",
              marketCode: "JP",
              languageTag: "ja",
              role: "active",
              localTitle: "現地ミーム",
              localAliases: [],
              usageNote: "Use with friends.",
              caution: "Check the setting.",
            },
          ],
          variants: [
            {
              id: "variant-1",
              targetMemeId: "meme-2",
              targetShortId: "m2",
              targetSlug: "local-variant",
              targetTitle: "Local variant",
              targetHref: "/en/memes/m2-local-variant",
              relation: "local_variant",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Where does this meme travel?");
    expect(html).toContain("Japan");
    expect(html).toContain("Local variant");
    expect(html).toContain('href="/en/memes/m2-local-variant"');
    expect(html).toContain('data-market-variant-count="1"');
  });

  it("does not render a successful but completely empty passport", () => {
    const html = renderToStaticMarkup(
      <MemeMarketPassport
        locale="ja"
        passport={{
          origin: {
            memeId: "meme-1",
            marketCode: "KR",
            languageTag: "ko",
            role: "origin",
            localTitle: "原文",
            localAliases: [],
            usageNote: null,
            caution: null,
          },
          profiles: [],
          variants: [],
        }}
      />,
    );

    expect(html).toBe("");
  });

  it("does not render an empty variants panel when reviewed profiles exist", () => {
    const html = renderToStaticMarkup(
      <MemeMarketPassport
        locale="ko"
        passport={{
          origin: {
            memeId: "meme-1",
            marketCode: "KR",
            languageTag: "ko",
            role: "origin",
            localTitle: "원문",
            localAliases: [],
            usageNote: "친구끼리 사용",
            caution: null,
          },
          profiles: [
            {
              memeId: "meme-1",
              marketCode: "KR",
              languageTag: "ko",
              role: "origin",
              localTitle: "원문",
              localAliases: [],
              usageNote: "친구끼리 사용",
              caution: null,
            },
          ],
          variants: [],
        }}
      />,
    );

    expect(html).toContain("원문");
    expect(html).toContain("친구끼리 사용");
    expect(html).not.toContain("연결된 현지 변형");
    expect(html).not.toContain("아직 검수된 현지 변형 연결이 없어요");
  });

  it("keeps an unavailable read distinct from a successful empty passport", () => {
    const html = renderToStaticMarkup(
      <MemeMarketPassport
        locale="en"
        passport={{
          dataStatus: "unavailable",
          origin: null,
          profiles: [],
          variants: [],
        }}
      />,
    );

    expect(html).toContain('data-market-passport="unavailable"');
    expect(html).toContain("Global market data is unavailable");
    expect(html.match(/Please check again soon/g)).toHaveLength(1);
    expect(html).not.toContain("Where does this meme travel?");
    expect(html).not.toContain("No reviewed local variant is connected yet.");
  });
});
