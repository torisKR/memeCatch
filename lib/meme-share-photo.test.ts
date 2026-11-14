import { describe, expect, it, vi } from "vitest";
import { encodePng } from "@/lib/png-raster";
import {
  canonicalShareImageUrl,
  loadSharePhoto,
  MIN_SHARE_PHOTO_SIDE,
  prepareSharePhoto,
  representativeImageUrl,
} from "@/lib/meme-share-photo";

function solid(width: number, height: number, rgb: [number, number, number]) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = rgb[0];
    rgba[index * 4 + 1] = rgb[1];
    rgba[index * 4 + 2] = rgb[2];
    rgba[index * 4 + 3] = 255;
  }
  return encodePng(width, height, rgba);
}

const approved = {
  is_representative: true,
  moderation_status: "approved",
  availability: "live",
  created_at: new Date("2026-03-01T00:00:00.000Z"),
};

describe("representative share photos", () => {
  it("uses the site path the detail page shows and skips external posters", () => {
    expect(representativeImageUrl({
      contents: [{ ...approved, thumbnail_url: "/ai-memes/hero.png", url: null }],
    })?.url).toBe("/ai-memes/hero.png");
    expect(representativeImageUrl({
      contents: [{
        ...approved,
        thumbnail_url: "/api/media/meme-thumbs/youtube/abc.jpg",
        url: "https://www.youtube.com/watch?v=abc",
        platform: "youtube",
        content_id: "abc",
      }],
    })?.url).toBe("/api/media/meme-thumbs/youtube/abc.jpg");
    expect(representativeImageUrl({
      contents: [{
        ...approved,
        thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        url: "https://www.youtube.com/watch?v=abc",
        platform: "youtube",
        content_id: "abc",
      }],
    })).toBeNull();
    expect(canonicalShareImageUrl("https://evil.example/a.png")).toBeNull();
    expect(canonicalShareImageUrl("http://127.0.0.1/a.png")).toBeNull();
    expect(canonicalShareImageUrl("https://user:pass@catchmeme.com/a.png")).toBeNull();
  });

  it("skips images whose shorter side is under 400px and formats Satori cannot decode", () => {
    const tiny = solid(200, 800, [255, 0, 0]);
    expect(Math.min(200, 800)).toBeLessThan(MIN_SHARE_PHOTO_SIDE);
    expect(prepareSharePhoto(tiny)).toBeNull();
    expect(prepareSharePhoto(solid(400, 800, [255, 0, 0]))?.width).toBe(400);
    expect(prepareSharePhoto(Buffer.from("RIFF....WEBP"))).toBeNull();
  });

  it("does not fetch a disallowed URL and treats a timeout as no image", async () => {
    const fetchImpl = vi.fn();
    expect(await loadSharePhoto("https://evil.example/a.png", fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    const slow = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    expect(await loadSharePhoto("/ai-memes/missing.png", slow, 20)).toBeNull();
  });
});
