import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/components/meme-card-poster", () => ({
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
  beforeAll(() => {
    const directory = join(process.cwd(), ".next/static/css");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "retired-product-failure.css"), "/* test stylesheet */");
  });

  it("serves the styled cardless 410 when MemeCard throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await retiredProductDocument("ko", {
      load: async () => [meme, meme, meme, meme],
    });
    const html = await response.text();

    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain("noindex");
    expect(html).toContain('href="/explore"');
    expect(html).toContain("밈 탐색");
    expect(html).not.toMatch(/href="[^"]*\/memes\//);
    expect(error).toHaveBeenCalledWith(
      "retired product document failed",
      expect.objectContaining({ locale: "ko", message: "MemeCard failed" }),
    );
    error.mockRestore();
  });
});
