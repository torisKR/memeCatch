// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminMemeContents } from "./admin-meme-contents";

const base = {
  content_id: null,
  thumbnail_url: null,
  caption: null,
  moderation_status: "approved" as const,
};

const tiktok = {
  ...base,
  id: "c1",
  platform: "TikTok",
  url: "https://www.tiktok.com/@pinkfong_official/video/7082196569302289665",
  availability: "live" as const,
  is_representative: true,
};

const instagram = {
  ...base,
  id: "c2",
  platform: "Instagram",
  url: "https://www.instagram.com/reel/C5p1LNnJWdS/",
  availability: "live" as const,
  is_representative: false,
};

describe("AdminMemeContents", () => {
  it("renders playable embeds for each linked SNS content", () => {
    const html = renderToStaticMarkup(
      <AdminMemeContents contents={[tiktok, instagram]} memeTitle="아파트 게임" />,
    );

    // Count and section heading
    expect(html).toContain("연결된 SNS 콘텐츠");
    expect(html).toContain("2개");

    // TikTok embed iframe from the source URL, no click-to-load
    expect(html).toContain(
      "www.tiktok.com/player/v1/7082196569302289665",
    );
    // Instagram embed iframe
    expect(html).toContain(
      "www.instagram.com/reel/C5p1LNnJWdS/embed/captioned/",
    );
    // Representative badge surfaces for the representative content only
    expect(html).toContain("대표");
    // Platform + moderation metadata chips
    expect(html).toContain("TikTok");
    expect(html).toContain("Instagram");
  });

  it("shows an empty state when a meme has no linked contents", () => {
    const html = renderToStaticMarkup(
      <AdminMemeContents contents={[]} memeTitle="빈 밈" />,
    );

    expect(html).toContain("연결된 SNS 임베드가 아직 없어요");
    expect(html).not.toContain("<iframe");
  });
});
