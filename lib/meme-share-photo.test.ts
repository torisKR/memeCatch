import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { encodePng } from "@/lib/png-raster";
import {
  canonicalShareImageUrl,
  loadSharePhoto,
  MAX_SHARE_PHOTO_BYTES,
  MIN_SHARE_PHOTO_SIDE,
  prepareSharePhoto,
  readPublicFile,
  representativeImageUrl,
  sharePhotoObjectPosition,
  youtubeThumbnailCandidates,
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

  it("reads a public file from disk and does not fetch", async () => {
    const disk = readFileSync("public/icons/icon-512.png");
    const fetchImpl = vi.fn();
    const photo = await loadSharePhoto("/icons/icon-512.png", fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    const encoded = photo?.dataUrl.split(",")[1] ?? "";
    expect(Buffer.from(encoded, "base64").equals(disk)).toBe(true);
  });

  it("rejects a ../ traversal path", async () => {
    const outside = readFileSync("package.json");
    for (const pathname of ["/../package.json", "/ai-memes/../../package.json"]) {
      const read = await readPublicFile(pathname);
      expect(read).toBeNull();
      expect(Buffer.from(read ?? []).equals(outside)).toBe(false);
    }
  });

  it("rejects an encoded traversal", async () => {
    const outside = readFileSync("package.json");
    for (const pathname of ["/%2e%2e/package.json", "%2e%2e%2fpackage.json"]) {
      const read = await readPublicFile(pathname);
      expect(read).toBeNull();
      expect(Buffer.from(read ?? []).equals(outside)).toBe(false);
    }
  });

  it("keeps tall photos high and centers square or landscape photos", () => {
    expect(sharePhotoObjectPosition(1000, 1500)).toBe("center 30%");
    expect(sharePhotoObjectPosition(1000, 1501)).toBe("center 30%");
    expect(sharePhotoObjectPosition(1000, 1499)).toBe("center center");
    expect(sharePhotoObjectPosition(1254, 1254)).toBe("center center");
  });

  it("rejects an absolute path outside public", async () => {
    const passwd = readFileSync("/etc/passwd");
    const read = await readPublicFile("/etc/passwd");
    expect(read).toBeNull();
    expect(Buffer.from(read ?? []).equals(passwd)).toBe(false);
    const escaped = await readPublicFile("/icons/../../package.json");
    expect(escaped).toBeNull();
    expect(Buffer.from(escaped ?? []).equals(readFileSync("package.json"))).toBe(false);
  });
});

const YOUTUBE_ID = "i-fYmbqktRA";
const YOUTUBE_RECORDED = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

function hrefOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function pngResponse(width: number, height: number, rgb: [number, number, number] = [20, 40, 60]) {
  return new Response(new Uint8Array(solid(width, height, rgb)), { status: 200 });
}

describe("YouTube thumbnail ladder", () => {
  it("keeps the recorded thumbnail in the share URL and tries larger variants of that video", () => {
    expect(representativeImageUrl({
      contents: [{
        ...approved,
        thumbnail_url: YOUTUBE_RECORDED,
        url: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
        platform: "youtube",
        content_id: YOUTUBE_ID,
      }],
    })?.url).toBe(YOUTUBE_RECORDED);
    expect(youtubeThumbnailCandidates(YOUTUBE_RECORDED)).toEqual([
      `https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${YOUTUBE_ID}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`,
    ]);
  });

  it("uses maxresdefault when that image is large enough", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      calls.push(hrefOf(input));
      return Promise.resolve(pngResponse(1280, 720, [10, 20, 30]));
    });
    const photo = await loadSharePhoto(YOUTUBE_RECORDED, fetchImpl);
    expect(photo?.width).toBe(1280);
    expect(photo?.height).toBe(720);
    expect(calls).toEqual([`https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`]);
  });

  it("skips a 200 placeholder by decoded size and uses the next large enough variant", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      calls.push(href);
      if (href.endsWith("/maxresdefault.jpg")) return Promise.resolve(pngResponse(120, 90));
      if (href.endsWith("/sddefault.jpg")) return Promise.resolve(pngResponse(640, 480, [1, 2, 3]));
      return Promise.resolve(pngResponse(480, 360));
    });
    const photo = await loadSharePhoto(YOUTUBE_RECORDED, fetchImpl);
    expect(photo?.width).toBe(640);
    expect(calls).toEqual([
      `https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${YOUTUBE_ID}/sddefault.jpg`,
    ]);

    const smallCalls: string[] = [];
    const small = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      smallCalls.push(href);
      if (href.endsWith("/maxresdefault.jpg")) return Promise.resolve(pngResponse(120, 90));
      if (href.endsWith("/sddefault.jpg")) return Promise.resolve(pngResponse(320, 240));
      return Promise.resolve(pngResponse(900, 600, [4, 5, 6]));
    });
    const hq = await loadSharePhoto(YOUTUBE_RECORDED, small);
    expect(hq?.width).toBe(900);
    expect(smallCalls).toHaveLength(3);

    const noneCalls: string[] = [];
    const none = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      noneCalls.push(href);
      if (href.endsWith("/hqdefault.jpg")) return Promise.resolve(pngResponse(480, 360));
      if (href.endsWith("/sddefault.jpg")) return Promise.resolve(pngResponse(320, 240));
      return Promise.resolve(pngResponse(120, 90));
    });
    expect(await loadSharePhoto(YOUTUBE_RECORDED, none)).toBeNull();
    expect(noneCalls).toHaveLength(3);
    expect(Math.min(480, 360)).toBeLessThan(MIN_SHARE_PHOTO_SIDE);
  });

  it("does not fetch a host outside i.ytimg.com", async () => {
    const fetchImpl = vi.fn();
    const blocked = [
      "https://evil.example/vi/i-fYmbqktRA/hqdefault.jpg",
      "https://img.youtube.com/vi/i-fYmbqktRA/hqdefault.jpg",
      "http://i.ytimg.com/vi/i-fYmbqktRA/hqdefault.jpg",
      "https://i.ytimg.com.evil.com/vi/i-fYmbqktRA/hqdefault.jpg",
      "https://user:pass@i.ytimg.com/vi/i-fYmbqktRA/hqdefault.jpg",
    ];
    for (const url of blocked) {
      expect(youtubeThumbnailCandidates(url)).toBeNull();
      expect(await loadSharePhoto(url, fetchImpl)).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not fetch a video id that is not 11 characters", async () => {
    const fetchImpl = vi.fn();
    const blocked = [
      "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      "https://i.ytimg.com/vi/abcdefghijkl/hqdefault.jpg",
      "https://i.ytimg.com/vi/i-fYmbqktR/hqdefault.jpg",
      "https://i.ytimg.com/vi/i-fYmbqktRA/not-a-thumb.png",
      "https://i.ytimg.com/vi/i-fYmbqktRA/hqdefault.jpg/extra",
    ];
    for (const url of blocked) {
      expect(youtubeThumbnailCandidates(url)).toBeNull();
      expect(await loadSharePhoto(url, fetchImpl)).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats a timeout as a miss and tries the next variant", async () => {
    const calls: string[] = [];
    const hang = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const href = hrefOf(input);
      calls.push(href);
      if (href.endsWith("/maxresdefault.jpg")) return hang(input, init);
      return Promise.resolve(pngResponse(640, 480, [7, 8, 9]));
    });
    const photo = await loadSharePhoto(YOUTUBE_RECORDED, fetchImpl, 30);
    expect(photo?.width).toBe(640);
    expect(calls[0]).toContain("maxresdefault.jpg");
    expect(calls[1]).toContain("sddefault.jpg");

    const all = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => hang(_input, init));
    expect(await loadSharePhoto(YOUTUBE_RECORDED, all, 20)).toBeNull();
    expect(all).toHaveBeenCalledTimes(3);
  });

  it("rejects an oversized body before reading it and while reading it", async () => {
    const declared = new Response(new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    }), {
      status: 200,
      headers: { "content-length": String(MAX_SHARE_PHOTO_BYTES + 1) },
    });
    let readByLoader = false;
    const body = declared.body;
    if (body) {
      const read = body.getReader.bind(body);
      const stream = body as { getReader: () => ReadableStreamDefaultReader<Uint8Array> };
      stream.getReader = () => {
        readByLoader = true;
        return read();
      };
    }
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      calls.push(href);
      if (href.endsWith("/maxresdefault.jpg")) return Promise.resolve(declared);
      return Promise.resolve(pngResponse(640, 480));
    });
    const photo = await loadSharePhoto(YOUTUBE_RECORDED, fetchImpl);
    expect(photo?.width).toBe(640);
    expect(readByLoader).toBe(false);

    const chunk = new Uint8Array(MAX_SHARE_PHOTO_BYTES + 1);
    const streaming = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      if (href.endsWith("/maxresdefault.jpg")) {
        return Promise.resolve(new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(chunk);
            controller.close();
          },
        }), { status: 200 }));
      }
      return Promise.resolve(pngResponse(800, 450));
    });
    const next = await loadSharePhoto(YOUTUBE_RECORDED, streaming);
    expect(next?.width).toBe(800);
  });
});
