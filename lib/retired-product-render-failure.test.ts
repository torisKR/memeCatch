import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/components/meme-card", () => ({
  MemeCard() {
    throw new Error("MemeCard failed");
  },
}));

import { retiredProductDocument } from "@/lib/retired-product-document";
import type { MemeListItem } from "@/lib/queries";

const meme = {
  id: "meme-1",
  short_id: "m1",
  slug: "meme-1",
  title: "카드",
  summary: "설명",
  category: "phrase",
  safety_level: "green",
  lifecycle_status: "rising",
  media_type: "image",
  origin_year: 2026,
  trend_score: 1,
} as MemeListItem;

describe("retired product render failures", () => {
  it("does not replace a MemeCard failure with a cardless page", async () => {
    await expect(
      retiredProductDocument("ko", { load: async () => [meme, meme, meme, meme] }),
    ).rejects.toThrow(/MemeCard failed/);
  });
});
