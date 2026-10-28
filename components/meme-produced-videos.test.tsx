/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeProducedVideos } from "./meme-produced-videos";

const video = { meme_id: "m1", production_id: "p1", youtube_video_id: "abcdefghijk", content_id: "c1", caption: "직접 만든 해설", privacy_status: "public" as const, site_linked_at: "2026-10-12T00:00:00Z",
  public_embed_verified: false, schema_metadata: null };
const verifiedVideo = { ...video, public_embed_verified: true, schema_metadata: {
  name: "실제 영상 제목", description: "실제 영상 설명", uploadDate: "2026-07-01T12:00:00Z",
  thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
} };

describe("MemeProducedVideos", () => {
  it("labels produced videos as explanations and never as original footage", () => {
    render(<MemeProducedVideos videos={[video]} memeTitle="테스트 밈" />);
    expect(screen.getByRole("heading", { name: "밈캐치가 설명하는 영상" })).toBeTruthy();
    expect(screen.getByTitle("테스트 밈 밈캐치 설명 영상").getAttribute("src")).toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(screen.queryByText(/원본 영상이라고/)).toBeNull();
  });

  it("renders nothing for an empty projection", () => {
    const { container } = render(<MemeProducedVideos videos={[]} memeTitle="테스트 밈" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the schema title and description visibly beside the identical player", () => {
    const { container } = render(<MemeProducedVideos videos={[verifiedVideo]} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(screen.getByRole("heading", { name: verifiedVideo.schema_metadata.name })).toBeTruthy();
    expect(screen.getByText(verifiedVideo.schema_metadata.description)).toBeTruthy();
    expect(container.querySelector("iframe")!.src).toBe(data.embedUrl);
    expect(container.querySelector("iframe")!.title).toBe(data.name);
    expect(data["@id"]).toBe(`https://catchmeme.com/memes/test-meme#${container.querySelector("li")!.id}`);
  });

  it("never emits schema for unverified metadata or nonindexable detail opt-out", () => {
    for (const candidate of [video, { ...verifiedVideo, schema_metadata: null }]) {
      const html = renderToStaticMarkup(<MemeProducedVideos videos={[candidate]} memeTitle="테스트 밈" structuredDataPath="/memes/test-meme" />);
      expect(html).toContain("<iframe");
      expect(html).not.toContain('application/ld+json');
    }
    const html = renderToStaticMarkup(<MemeProducedVideos videos={[verifiedVideo]} memeTitle="테스트 밈" />);
    expect(html).not.toContain('application/ld+json');
  });

  it.each(["unlisted", "private"])("renders no iframe or VideoObject for forged %s input", (privacyStatus) => {
    const html = renderToStaticMarkup(<MemeProducedVideos
      videos={[{ ...verifiedVideo, privacy_status: privacyStatus }]}
      memeTitle="테스트 밈"
      structuredDataPath="/memes/test-meme"
    />);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain('application/ld+json');
  });

  it("does not let a hidden duplicate mask a later public video", () => {
    const html = renderToStaticMarkup(<MemeProducedVideos
      videos={[
        { ...verifiedVideo, production_id: "hidden", privacy_status: "unlisted" },
        { ...verifiedVideo, production_id: "public" },
      ]}
      memeTitle="테스트 밈"
      structuredDataPath="/memes/test-meme"
    />);
    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(html.match(/<script type="application\/ld\+json">/g)).toHaveLength(1);
  });

  it("renders one server-side VideoObject and iframe per real video ID", () => {
    const html = renderToStaticMarkup(<MemeProducedVideos videos={[verifiedVideo, { ...verifiedVideo, production_id: "duplicate" }]}
      memeTitle="테스트 밈" structuredDataPath="/en/memes/test-meme" />);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]["@type"]).toBe("VideoObject");
    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(blocks[0]["@id"]).toContain("/en/memes/test-meme#produced-video-");
  });
});

