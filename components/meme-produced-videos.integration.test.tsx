/** @vitest-environment jsdom */
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createStaticClient: () => ({ from }),
}));

import { getPublicMemeProducedVideos } from "@/lib/video-production/public.server";
import { MemeProducedVideos } from "./meme-produced-videos";

const baseRow = {
  meme_id: "m1",
  production_id: "p1",
  youtube_video_id: "abcdefghijk",
  content_id: "c1",
  caption: "사이트 설명",
  privacy_status: "public",
  site_linked_at: "2026-10-12T00:00:00Z",
  public_embed_verified: true,
  video_name: "실제 설명 영상",
  video_description: "검증된 영상 설명",
  video_thumbnail_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
  video_upload_date: "2026-07-01T12:00:00Z",
} as const;

function mockRows(rows: unknown[], error: unknown = null) {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({ order: async () => ({ data: rows, error }) }),
    }),
  });
}

afterEach(() => {
  cleanup();
  from.mockReset();
});

describe("public produced video integration gate", () => {
  it("keeps the visible player and VideoObject in sync for a verified public row", async () => {
    mockRows([baseRow]);
    const videos = await getPublicMemeProducedVideos("m1");
    const { container } = render(
      <MemeProducedVideos videos={videos} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    const schema = JSON.parse(script!.textContent!);
    const iframe = container.querySelector("iframe")!;
    expect(screen.getByRole("heading", { name: baseRow.video_name })).toBeTruthy();
    expect(screen.getByText(baseRow.video_description)).toBeTruthy();
    expect(iframe.src).toBe(schema.embedUrl);
    expect(iframe.title).toBe(schema.name);
    expect(schema.description).toBe(baseRow.video_description);
    expect(schema["@id"]).toBe(`https://catchmeme.com/memes/test-meme#${container.querySelector("li")!.id}`);
    expect(schema["@type"]).toBe("VideoObject");
  });

  it.each([
    ["private", true],
    ["unlisted", true],
    ["public", false],
    ["public", undefined],
    ["public", "true"],
    ["public", 1],
  ])("never emits VideoObject for visibility/proof %s/%s", async (privacy_status, proof) => {
    mockRows([{ ...baseRow, privacy_status, public_embed_verified: proof }]);
    const videos = await getPublicMemeProducedVideos("m1");
    const { container } = render(
      <MemeProducedVideos videos={videos} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />,
    );
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it.each([
    { video_name: null },
    { video_thumbnail_url: "https://i.ytimg.com/vi/otherabcdef/hqdefault.jpg" },
    { video_upload_date: "2099-01-01T00:00:00Z" },
    { youtube_video_id: "invalid" },
  ])("fails closed for invalid metadata or video id: %s", async (fields) => {
    mockRows([{ ...baseRow, ...fields }]);
    const videos = await getPublicMemeProducedVideos("m1");
    const { container } = render(
      <MemeProducedVideos videos={videos} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />,
    );
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("does not emit schema for a database failure or a non-indexable detail", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRows([baseRow], { code: "42501" });
    const failed = await getPublicMemeProducedVideos("m1");
    expect(logger).toHaveBeenCalledWith("[meme-produced-videos] public projection unavailable", { failure: "query_error" });
    logger.mockRestore();
    expect(render(<MemeProducedVideos videos={failed} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />).container.querySelector("script")).toBeNull();

    mockRows([baseRow]);
    const videos = await getPublicMemeProducedVideos("m1");
    const { container } = render(<MemeProducedVideos videos={videos} memeTitle="테스트 밈" />);
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
