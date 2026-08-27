import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { getGlobalFeed } = vi.hoisted(() => ({
  getGlobalFeed: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, prefetch, ...props }: ComponentPropsWithoutRef<"a"> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props}>{children}</a>;
  },
}));

vi.mock("@/components/meme-thumbnail", () => ({
  MemeThumbnail: ({ src }: { src: string | null }) => (
    <span data-thumbnail-src={src ?? ""} />
  ),
}));

vi.mock("@/lib/global-feed.server", () => ({ getGlobalFeed }));

import GlobalFeedPage from "@/app/(default)/global/page";
import { GlobalFeedTabs } from "@/components/global-feed/global-feed-tabs";
import {
  resolveGlobalFeedPlatform,
  type GlobalFeedItem,
} from "@/lib/global-feed.types";

const item: GlobalFeedItem = {
  id: "meme-1",
  short_id: "abc123",
  slug: "lead-meme",
  title: "Lead meme",
  summary: "The database summary belongs in the lead composition.",
  category: "image",
  safety_level: "green",
  lifecycle_status: "active",
  media_type: "video",
  origin_year: 2026,
  trend_score: 91,
  platform: "tiktok",
  content_url: "https://www.tiktok.com/@creator/video/1",
  thumbnail_url: "https://example.com/meme.jpg",
};

describe("GlobalFeedTabs", () => {
  it("queries only the platform restored from promised search params", async () => {
    getGlobalFeed.mockResolvedValue({ status: "empty", items: [] });

    const page = await GlobalFeedPage({
      searchParams: Promise.resolve({ platform: "tiktok" }),
    });
    const html = renderToStaticMarkup(page);

    expect(getGlobalFeed).toHaveBeenCalledTimes(1);
    expect(getGlobalFeed).toHaveBeenCalledWith(["tiktok"], 24);
    expect(html).toContain('href="/global?platform=tiktok"');
    expect(html).toContain('aria-current="page"');
  });

  it("keeps platform state in links and renders distinct result states", () => {
    const ready = renderToStaticMarkup(
      <GlobalFeedTabs
        activeKey="tiktok"
        feed={{ status: "ready", items: [item] }}
      />,
    );
    const empty = renderToStaticMarkup(
      <GlobalFeedTabs
        activeKey="instagram"
        feed={{ status: "empty", items: [] }}
      />,
    );
    const error = renderToStaticMarkup(
      <GlobalFeedTabs
        activeKey="youtube"
        feed={{ status: "error", items: [] }}
      />,
    );

    expect(ready).toContain('href="/global?platform=youtube"');
    expect(ready).toContain('href="/global?platform=tiktok"');
    expect(ready).toContain('href="/global?platform=instagram"');
    expect(ready).toContain('aria-current="page"');
    expect(ready).toContain("Lead meme");
    expect(ready).toContain(
      "The database summary belongs in the lead composition.",
    );
    expect(ready).toContain("Open Korean detail");
    expect(ready).toContain("data-global-feed-platform");
    expect(empty).toContain("No reviewed Instagram picks yet");
    expect(error).toContain('role="alert"');
    expect(error).toContain("No placeholder memes were substituted.");

    expect(resolveGlobalFeedPlatform("instagram")).toBe("instagram");
    expect(resolveGlobalFeedPlatform(["tiktok", "instagram"])).toBe(
      "youtube",
    );
    expect(resolveGlobalFeedPlatform("unknown")).toBe("youtube");
  });
});
