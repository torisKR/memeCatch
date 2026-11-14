import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const posts = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createStaticClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === "memes") {
            return {
              data: {
                title: "파이팅",
                summary: "힘내라는 한 마디",
                safety_level: "green",
                lifecycle_status: "rising",
              },
            };
          }
          return { data: posts.row };
        },
      };
      return builder;
    },
  }),
}));

const translations = vi.hoisted(() => ({
  getLocalizedMemeByShortId: vi.fn(),
}));

vi.mock("@/lib/meme-translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meme-translations")>();
  return {
    ...actual,
    getLocalizedMemeByShortId: translations.getLocalizedMemeByShortId,
  };
});

import { GET as koreanImage } from "@/app/(default)/memes/[key]/opengraph-image-k2cx9c/route";
import { GET as localeImage } from "@/app/[locale]/memes/[key]/opengraph-image/route";
import { metadata as arabicMissingMetadata } from "@/app/ar/not-found";
import { generateMetadata as generateCommunityMetadata } from "@/app/(default)/community/[id]/page";
import { isGenericShareImageUrl } from "@/lib/meme-share-image";

const POST_ID = "11111111-1111-4111-8111-111111111111";

function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

async function readPng(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  const body = Buffer.from(await response.arrayBuffer());
  expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
  expect(body.byteLength).toBeGreaterThan(5_000);
  expect(body.byteLength).toBeLessThan(5 * 1024 * 1024);
  return body;
}

function saveSample(name: string, body: Buffer) {
  const directory = "/opt/cursor/artifacts";
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${name}.png`, body);
}

describe("per-meme share cards", () => {
  it("paints the Korean name and meaning on the existing card route", async () => {
    const response = await koreanImage(new Request("http://localhost/memes/fight0001-paiting/opengraph-image-k2cx9c"), {
      params: Promise.resolve({ key: "fight0001-paiting" }),
    });
    saveSample("ko-fighting", await readPng(response));
  });

  it("paints translated CJK titles with the locale card, clamped inside 1200x630", async () => {
    const long = "이것은아주긴제목입니다클램프되어야합니다정말로";
    for (const [locale, title, summary, original] of [
      ["en", "Fighting", "A cheer that means keep going.", "파이팅"],
      ["ja", "ファイティング", "頑張れ、という応援の言葉。", "파이팅"],
      ["zh", "加油", "表示鼓励对方继续努力的一句韩语。", "파이팅"],
      ["zh-tw", "加油", "表示鼓勵對方繼續努力的一句韓語。", "파이팅"],
      ["ja", long, "意味は短い。", "파이팅"],
    ] as const) {
      translations.getLocalizedMemeByShortId.mockResolvedValue({
        title,
        summary,
        original: { title: original },
      });
      const response = await localeImage(new Request(`http://localhost/${locale}/memes/fight0001/opengraph-image`), {
        params: Promise.resolve({ locale, key: "fight0001-fighting" }),
      });
      const body = await readPng(response);
      saveSample(`${locale}-${title.slice(0, 8)}`, body);
    }
  });

  it("uses the linked meme card for a community post about one meme", async () => {
    posts.row = {
      id: POST_ID,
      title: "오늘 이거 씀",
      body: "회의에서 썼어요",
      memes: {
        id: "m1",
        short_id: "fight0001",
        slug: "paiting",
        title: "파이팅",
        summary: "힘내라는 한 마디",
        category: "phrase",
        safety_level: "green",
      },
    };
    const metadata = await generateCommunityMetadata({ params: Promise.resolve({ id: POST_ID }) });
    const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph) ? metadata.openGraph : undefined;
    const twitter = metadata.twitter && !Array.isArray(metadata.twitter) ? metadata.twitter : undefined;
    expect(openGraph).toMatchObject({
      title: "파이팅",
      url: `/community/${POST_ID}`,
      images: [{ url: "/memes/fight0001-paiting/opengraph-image-k2cx9c", width: 1200, height: 630 }],
    });
    expect(twitter).toMatchObject({
      card: "summary_large_image",
      title: "파이팅",
      images: [{ url: "/memes/fight0001-paiting/opengraph-image-k2cx9c" }],
    });
    expect(isGenericShareImageUrl("/memes/fight0001-paiting/opengraph-image-k2cx9c")).toBe(false);
  });

  it("keeps a community post that is not about one meme on the locale card", async () => {
    posts.row = {
      id: POST_ID,
      title: "자유 주제",
      body: "밈 없음",
      memes: null,
    };
    const metadata = await generateCommunityMetadata({ params: Promise.resolve({ id: POST_ID }) });
    const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph) ? metadata.openGraph : undefined;
    expect(openGraph).toMatchObject({
      title: "자유 주제",
      images: [{ url: "/og/ko" }],
    });
    expect(metadata.twitter).toBeUndefined();
  });

  it("does not attach the site card to a missing Arabic meme", () => {
    expect(arabicMissingMetadata.openGraph).toEqual({ images: [] });
    expect(arabicMissingMetadata.twitter).toEqual({ images: [] });
    expect(JSON.stringify(arabicMissingMetadata)).not.toMatch(/\/og\/|opengraph-image/);
  });
});
