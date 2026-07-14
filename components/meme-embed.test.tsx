// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemeEmbed } from "./meme-embed";

afterEach(cleanup);

const tiktokContent = {
  platform: "TikTok",
  content_id: "6833754937747361025",
  url: "https://www.tiktok.com/@coco.midnight/video/6833754937747361025",
  thumbnail_url: null,
  availability: "live" as const,
  caption: null,
};

describe("MemeEmbed", () => {
  it("labels a non-representative social embed as a related usage example", () => {
    render(
      <MemeEmbed
        content={tiktokContent}
        title="심쿵"
        isRepresentative={false}
      />
    );

    expect(screen.getByText("사용 예시")).toBeTruthy();
    expect(screen.getByRole("button", { name: "관련 콘텐츠 보기" })).toBeTruthy();
    expect(screen.getByText(/원본이 아닌 사용 예시/)).toBeTruthy();
    expect(screen.queryByText("대표 콘텐츠 보기")).toBeNull();
  });

  it("keeps representative wording for a representative social embed", () => {
    render(
      <MemeEmbed
        content={tiktokContent}
        title="심쿵"
        isRepresentative
      />
    );

    expect(screen.getByRole("button", { name: "대표 콘텐츠 보기" })).toBeTruthy();
    expect(screen.queryByText("사용 예시")).toBeNull();
  });
});
