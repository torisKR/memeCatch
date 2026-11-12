import { describe, expect, it } from "vitest";
import {
  memeCardArtAlt,
  memeCardArtFromMeme,
  memeCardArtSources,
  ownedMemeCardArtPath,
} from "@/lib/meme-card-art";

const OWNED = "/api/media/meme-card-art/ppap.webp";

describe("owned meme card art", () => {
  it("accepts a same-origin 4:3 original and ignores everything else", () => {
    expect(ownedMemeCardArtPath(OWNED)).toBe(OWNED);
    expect(ownedMemeCardArtPath(`https://catchmeme.com${OWNED}?size=card`)).toBe(OWNED);
    expect(ownedMemeCardArtPath(`https://www.catchmeme.com${OWNED}`)).toBe(OWNED);

    for (const rejected of [
      "https://i.ytimg.com/vi/example/hqdefault.jpg",
      "https://img.youtube.com/vi/example/mqdefault.jpg",
      "https://catchmeme.com/api/media/meme-thumbs/youtube/a.webp",
      "https://images.example.com/cat.jpg",
      "data:image/svg+xml;base64,abc",
      "http://catchmeme.com/api/media/meme-card-art/ppap.webp",
      "https://catchmeme.com:444/api/media/meme-card-art/ppap.webp",
      "/api/media/meme-card-art/../secret.webp",
    ]) {
      expect(ownedMemeCardArtPath(rejected)).toBeNull();
    }
  });

  it("builds a 1200 original with 600, 900, and 1200 srcset candidates", () => {
    expect(memeCardArtSources(OWNED)).toEqual({
      src: `${OWNED}?w=1200`,
      srcSet: `${OWNED}?w=600 600w, ${OWNED}?w=900 900w, ${OWNED}?w=1200 1200w`,
      width: 1200,
      height: 900,
    });
  });

  it("reads only owned art and never promotes a YouTube still", () => {
    expect(
      memeCardArtFromMeme({
        meme_contents: [
          { thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg", is_representative: true },
        ],
      }),
    ).toBeNull();

    expect(
      memeCardArtFromMeme({
        card_art_url: `https://catchmeme.com${OWNED}`,
        meme_contents: [
          { thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg", is_representative: true },
        ],
      })?.src,
    ).toBe(`${OWNED}?w=1200`);
  });

  it("localizes the symbol-illustration alt text", () => {
    expect(memeCardArtAlt("중꺾마", "ko")).toBe("중꺾마 상징 일러스트");
    expect(memeCardArtAlt("Jung-kkeok-ma", "en")).toBe("Jung-kkeok-ma symbol illustration");
    expect(memeCardArtAlt("中折魔", "ja")).toBe("中折魔の象徴イラスト");
  });
});
