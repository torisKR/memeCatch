import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { encodeJpeg } from "@/lib/jpeg-encode";
import { decodePng, encodePng } from "@/lib/png-raster";
import {
  canonicalShareImageUrl,
  loadSharePhoto,
  MAX_SHARE_PHOTO_BYTES,
  MIN_SHARE_PHOTO_SIDE,
  blackEdgeRuns,
  columnIsNearBlack,
  nearBlackEdgeRows,
  prepareSharePhoto,
  readPublicFile,
  representativeImageUrl,
  rowIsNearBlack,
  SHARE_PHOTO_EDGE_CAP,
  SHARE_PHOTO_EDGE_MARGIN,
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
      if (href.endsWith("/sddefault.jpg")) return Promise.resolve(pngResponse(640, 480, [40, 80, 120]));
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
      return Promise.resolve(pngResponse(900, 600, [40, 80, 120]));
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
      return Promise.resolve(pngResponse(640, 480, [40, 80, 120]));
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

  it("stops reading once the streamed body passes the size cap", async () => {
    let reads = 0;
    const streaming = vi.fn((input: RequestInfo | URL) => {
      const href = hrefOf(input);
      if (!href.endsWith("/maxresdefault.jpg")) return Promise.resolve(pngResponse(800, 450));
      return Promise.resolve(new Response(new ReadableStream({
        pull(controller) {
          reads += 1;
          if (reads === 1) {
            controller.enqueue(new Uint8Array(1024));
            return;
          }
          if (reads === 2) {
            controller.enqueue(new Uint8Array(MAX_SHARE_PHOTO_BYTES));
            return;
          }
          controller.enqueue(new Uint8Array([9]));
          controller.close();
        },
      }, new CountQueuingStrategy({ highWaterMark: 0 })), { status: 200 }));
    });
    const photo = await loadSharePhoto(YOUTUBE_RECORDED, streaming);
    expect(photo?.width).toBe(800);
    expect(reads).toBe(2);
  });

  it("does not follow redirects", async () => {
    const modes: Array<RequestRedirect | undefined> = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      modes.push(init?.redirect);
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/stolen.jpg" },
      }));
    });
    expect(await loadSharePhoto(YOUTUBE_RECORDED, fetchImpl)).toBeNull();
    expect(modes).toEqual(["manual", "manual", "manual"]);
    expect(fetchImpl.mock.calls.map(([input]) => hrefOf(input)).some((url) => url.includes("evil.example"))).toBe(false);
  });
});

function rows(width: number, height: number, colorAt: (y: number) => [number, number, number]) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const [red, green, blue] = colorAt(y);
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      rgba[index] = red;
      rgba[index + 1] = green;
      rgba[index + 2] = blue;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

describe("edge trim", () => {
  it("counts a line as a bar at 98% black and not just under", () => {
    const width = 100;
    const rgba = Buffer.alloc(width * 4);
    for (let x = 0; x < 2; x += 1) rgba[x * 4] = 255;
    expect(rowIsNearBlack(rgba, width, 0)).toBe(true);
    rgba[2 * 4] = 255;
    expect(rowIsNearBlack(rgba, width, 0)).toBe(false);
  });

  it("drops top and bottom letterbox bars", () => {
    const width = 800;
    const height = 700;
    const bar = 80;
    expect(bar + SHARE_PHOTO_EDGE_MARGIN).toBeLessThanOrEqual(height * SHARE_PHOTO_EDGE_CAP);
    const letterbox = encodePng(width, height, rows(width, height, (y) => (
      y < bar || y >= height - bar ? [0, 0, 0] : [240, 180, 20]
    )));
    const photo = prepareSharePhoto(letterbox);
    expect(photo?.width).toBe(width);
    expect(photo?.height).toBe(height - (bar + SHARE_PHOTO_EDGE_MARGIN) * 2);
    const trimmed = decodePng(Buffer.from(photo?.dataUrl.split(",")[1] ?? "", "base64"));
    expect(nearBlackEdgeRows(trimmed.rgba, trimmed.width, trimmed.height)).toEqual({ top: 0, bottom: 0 });
  });

  it("drops left and right pillarbox bars", () => {
    const width = 800;
    const height = 500;
    const bar = 80;
    expect(bar + SHARE_PHOTO_EDGE_MARGIN).toBeLessThanOrEqual(width * SHARE_PHOTO_EDGE_CAP);
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const black = x < bar || x >= width - bar;
        rgba[index] = black ? 0 : 240;
        rgba[index + 1] = black ? 0 : 180;
        rgba[index + 2] = black ? 0 : 20;
        rgba[index + 3] = 255;
      }
    }
    const photo = prepareSharePhoto(encodePng(width, height, rgba));
    expect(photo?.width).toBe(width - (bar + SHARE_PHOTO_EDGE_MARGIN) * 2);
    expect(photo?.height).toBe(height);
    const trimmed = decodePng(Buffer.from(photo?.dataUrl.split(",")[1] ?? "", "base64"));
    expect(columnIsNearBlack(trimmed.rgba, trimmed.width, trimmed.height, 0)).toBe(false);
    expect(columnIsNearBlack(trimmed.rgba, trimmed.width, trimmed.height, trimmed.width - 1)).toBe(false);
    expect(blackEdgeRuns(trimmed.rgba, trimmed.width, trimmed.height)).toEqual({
      top: 0, bottom: 0, left: 0, right: 0,
    });
  });

  it("leaves an image without bars byte-identical", () => {
    const plain = solid(800, 500, [240, 180, 20]);
    const untouched = prepareSharePhoto(plain);
    expect(untouched?.width).toBe(800);
    expect(untouched?.height).toBe(500);
    expect(Buffer.from(untouched?.dataUrl.split(",")[1] ?? "", "base64").equals(plain)).toBe(true);
  });

  it("leaves an all-dark image untouched when every edge exceeds 35%", () => {
    const dark = solid(800, 800, [0, 0, 0]);
    const photo = prepareSharePhoto(dark);
    expect(800).toBeGreaterThan(800 * SHARE_PHOTO_EDGE_CAP);
    expect(photo?.width).toBe(800);
    expect(photo?.height).toBe(800);
    expect(Buffer.from(photo?.dataUrl.split(",")[1] ?? "", "base64").equals(dark)).toBe(true);
  });

  it("drops a photo whose trimmed short side is under 400px", () => {
    const width = 640;
    const height = 480;
    const bar = 183;
    expect(bar + SHARE_PHOTO_EDGE_MARGIN).toBeLessThanOrEqual(width * SHARE_PHOTO_EDGE_CAP);
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const black = x < bar || x >= width - bar;
        rgba[index] = black ? 0 : 40;
        rgba[index + 1] = black ? 0 : 180;
        rgba[index + 2] = black ? 0 : 90;
        rgba[index + 3] = 255;
      }
    }
    expect(prepareSharePhoto(encodePng(width, height, rgba))).toBeNull();
    const trimmedWidth = width - (bar + SHARE_PHOTO_EDGE_MARGIN) * 2;
    expect(trimmedWidth).toBe(270);
    expect(Math.min(trimmedWidth, height)).toBeLessThan(MIN_SHARE_PHOTO_SIDE);
  });

  it("uses the trimmed size for the tall-photo position", () => {
    const tall = prepareSharePhoto(encodePng(600, 1000, rows(600, 1000, (y) => (
      y < 80 || y >= 920 ? [0, 0, 0] : [240, 180, 20]
    ))));
    expect(tall?.width).toBe(600);
    expect(tall?.height).toBe(1000 - (80 + SHARE_PHOTO_EDGE_MARGIN) * 2);
    expect(sharePhotoObjectPosition(600, 1000)).toBe("center 30%");
    expect(sharePhotoObjectPosition(tall?.width ?? 0, tall?.height ?? 0)).toBe("center center");
  });

  it("trims a baseline jpeg the same way", () => {
    const width = 800;
    const height = 560;
    const bar = 40;
    const jpeg = encodeJpeg({
      width,
      height,
      rgba: rows(width, height, (y) => (y < bar || y >= height - bar ? [0, 0, 0] : [220, 40, 40])),
    }, 90);
    const photo = prepareSharePhoto(jpeg);
    expect(photo?.width).toBe(width);
    expect(photo?.height).toBe(height - (bar + SHARE_PHOTO_EDGE_MARGIN) * 2);
    expect(photo?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("trims rows at luminance 15 and 16 and leaves 17", () => {
    const width = 420;
    const height = 420;
    const content: [number, number, number] = [200, 80, 40];
    const trimmedHeight = height - 1 - SHARE_PHOTO_EDGE_MARGIN;
    // Gray 16 is 15.999... under the luma weights, so it does not separate <= from <.
    // [31, 7, 23] is luminance 16 exactly.
    const bars: Array<[number, number, number]> = [[15, 15, 15], [31, 7, 23]];
    for (const bar of bars) {
      const photo = prepareSharePhoto(encodePng(width, height, rows(width, height, (y) => (
        y === 0 ? bar : content
      ))));
      expect(photo?.width).toBe(width);
      expect(photo?.height).toBe(trimmedHeight);
      const trimmed = decodePng(Buffer.from(photo?.dataUrl.split(",")[1] ?? "", "base64"));
      expect(rowIsNearBlack(trimmed.rgba, trimmed.width, 0)).toBe(false);
    }
    const kept = encodePng(width, height, rows(width, height, (y) => (
      y === 0 ? [17, 17, 17] : content
    )));
    const untouched = prepareSharePhoto(kept);
    expect(Buffer.from(untouched?.dataUrl.split(",")[1] ?? "", "base64").equals(kept)).toBe(true);
  });

  it("trims a 34% bar including the 2px margin and leaves a 36% bar", () => {
    const width = 1000;
    const height = 500;
    const content: [number, number, number] = [200, 80, 40];
    const pillar = (bar: number) => {
      const rgba = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const [red, green, blue] = x < bar ? [0, 0, 0] : content;
          rgba[index] = red;
          rgba[index + 1] = green;
          rgba[index + 2] = blue;
          rgba[index + 3] = 255;
        }
      }
      return encodePng(width, height, rgba);
    };
    const under = Math.round(width * 0.34);
    expect(under + SHARE_PHOTO_EDGE_MARGIN).toBeLessThanOrEqual(width * SHARE_PHOTO_EDGE_CAP);
    const trimmed = prepareSharePhoto(pillar(under));
    expect(trimmed?.height).toBe(height);
    expect(trimmed?.width).toBe(width - under - SHARE_PHOTO_EDGE_MARGIN);
    const over = Math.round(width * 0.36);
    expect(over + SHARE_PHOTO_EDGE_MARGIN).toBeGreaterThan(width * SHARE_PHOTO_EDGE_CAP);
    const kept = pillar(over);
    const untouched = prepareSharePhoto(kept);
    expect(untouched?.width).toBe(width);
    expect(untouched?.height).toBe(height);
    expect(width - over).toBeGreaterThan(1);
    expect(Buffer.from(untouched?.dataUrl.split(",")[1] ?? "", "base64").equals(kept)).toBe(true);
  });

  it("leaves a 95% dark first row in place when it is not a bar", () => {
    const width = 400;
    const height = 400;
    const rgba = rows(width, height, () => [200, 80, 40]);
    const dark = Math.round(width * 0.95);
    expect(dark).toBeLessThan(width * 0.98);
    for (let x = 0; x < dark; x += 1) {
      const index = x * 4;
      rgba[index] = 0;
      rgba[index + 1] = 0;
      rgba[index + 2] = 0;
    }
    const png = encodePng(width, height, rgba);
    const photo = prepareSharePhoto(png);
    expect(Buffer.from(photo?.dataUrl.split(",")[1] ?? "", "base64").equals(png)).toBe(true);
  });

  const bandWidth = 1000;
  const bandHeight = 500;
  const bandContent: [number, number, number] = [200, 80, 40];

  function bandPhoto(specs: Array<{ dark: number; bright?: [number, number, number] }>) {
    const rgba = Buffer.alloc(bandWidth * bandHeight * 4);
    for (let y = 0; y < bandHeight; y += 1) {
      const spec = specs[y];
      const bright = spec?.bright ?? [20, 20, 20];
      for (let x = 0; x < bandWidth; x += 1) {
        const color = spec == null ? bandContent : x < spec.dark ? [0, 0, 0] : bright;
        const index = (y * bandWidth + x) * 4;
        rgba[index] = color[0];
        rgba[index + 1] = color[1];
        rgba[index + 2] = color[2];
        rgba[index + 3] = 255;
      }
    }
    return encodePng(bandWidth, bandHeight, rgba);
  }

  function repeat(count: number, spec: { dark: number; bright?: [number, number, number] }) {
    return Array.from({ length: count }, () => spec);
  }

  it("trims through one 85% noise line inside a uniform black band", () => {
    const black = { dark: bandWidth };
    const noise = { dark: Math.round(bandWidth * 0.85) };
    const band = [...repeat(10, black), noise, ...repeat(10, black)];
    const photo = prepareSharePhoto(bandPhoto(band));
    expect(photo?.width).toBe(bandWidth);
    expect(photo?.height).toBe(bandHeight - band.length - SHARE_PHOTO_EDGE_MARGIN);
  });

  it("trims a uniform band whose first line is the 85% noise line", () => {
    const black = { dark: bandWidth };
    const noise = { dark: Math.round(bandWidth * 0.85) };
    const band = [noise, ...repeat(20, black)];
    const photo = prepareSharePhoto(bandPhoto(band));
    expect(photo?.width).toBe(bandWidth);
    expect(photo?.height).toBe(bandHeight - band.length - SHARE_PHOTO_EDGE_MARGIN);
  });

  it("keeps the strict run when a fourth noise line interrupts the band", () => {
    const black = { dark: bandWidth };
    const noise = { dark: Math.round(bandWidth * 0.85) };
    const strict = repeat(10, black);
    const photo = prepareSharePhoto(bandPhoto([...strict, ...repeat(4, noise), ...repeat(10, black)]));
    expect(photo?.height).toBe(bandHeight - strict.length - SHARE_PHOTO_EDGE_MARGIN);
  });

  it("stops the band at a 79% line", () => {
    const black = { dark: bandWidth };
    const strict = repeat(10, black);
    const photo = prepareSharePhoto(bandPhoto([
      ...strict,
      { dark: Math.round(bandWidth * 0.79) },
      ...repeat(10, black),
    ]));
    expect(photo?.height).toBe(bandHeight - strict.length - SHARE_PHOTO_EDGE_MARGIN);
  });

  it("does not extend a dark scene whose rows vary", () => {
    const varied = { dark: Math.round(bandWidth * 0.98), bright: [29, 29, 29] as [number, number, number] };
    const almost = { dark: Math.round(bandWidth * 0.979), bright: [29, 29, 29] as [number, number, number] };
    const strict = repeat(10, varied);
    const photo = prepareSharePhoto(bandPhoto([...strict, ...repeat(2, almost), ...repeat(10, varied)]));
    expect(photo?.height).toBe(bandHeight - strict.length - SHARE_PHOTO_EDGE_MARGIN);
  });
});
