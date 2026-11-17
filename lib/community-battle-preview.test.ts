import { describe, expect, it } from "vitest";
import { communityBattleThumbnail } from "@/lib/community-battle-preview";

describe("communityBattleThumbnail", () => {
  it("uses the first locally uploaded markdown image", () => {
    expect(
      communityBattleThumbnail(
        "본문\n![업로드](/api/media/meme-uploads/user-1/photo.webp)\nhttps://youtu.be/dQw4w9WgXcQ",
      ),
    ).toBe("/api/media/meme-uploads/user-1/photo.webp");
  });

  it("derives a canonical YouTube thumbnail from safe video links", () => {
    expect(
      communityBattleThumbnail(
        "[영상](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s)",
      ),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(communityBattleThumbnail("https://youtu.be/jrruPm_tU_A")).toBe(
      "https://i.ytimg.com/vi/jrruPm_tU_A/hqdefault.jpg",
    );
  });

  it("rejects remote images, unsafe local paths, and non-YouTube URLs", () => {
    expect(communityBattleThumbnail("![원격](https://example.com/image.jpg)")).toBeNull();
    expect(communityBattleThumbnail("![우회](/api/media/meme-uploads/../secret.jpg)")).toBeNull();
    expect(communityBattleThumbnail("![다른 내부 미디어](/api/media/meme-thumbs/example.jpg)")).toBeNull();
    expect(communityBattleThumbnail("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(communityBattleThumbnail("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(communityBattleThumbnail("https://youtube.com/watch?v=too-short")).toBeNull();
  });
});
