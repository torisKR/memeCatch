import type { Metadata } from "next";
import { GlobalFeedTabs } from "@/components/global-feed/global-feed-tabs";
import { getGlobalFeed } from "@/lib/global-feed.server";
import {
  resolveGlobalFeedPlatform,
  type FeedPlatformKey,
} from "@/lib/global-feed.types";
import { koreanPageShare } from "@/lib/korean-share-metadata";
import type { SocialPlatform } from "@/lib/source-platform";

const GLOBAL_TITLE = "Global Meme Feed";
const GLOBAL_DESCRIPTION =
  "Browse reviewed YouTube, TikTok, and Instagram meme sources. Each item opens a Korean MemeCatch detail page with context and safety guidance.";

export const metadata: Metadata = {
  title: GLOBAL_TITLE,
  description: GLOBAL_DESCRIPTION,
  alternates: { canonical: "/global" },
  ...koreanPageShare({
    title: GLOBAL_TITLE,
    description: GLOBAL_DESCRIPTION,
    pathname: "/global",
  }),
};

const QUERY_PLATFORMS: Record<
  FeedPlatformKey,
  readonly [SocialPlatform, ...SocialPlatform[]]
> = {
  youtube: ["youtube", "youtube_shorts"],
  tiktok: ["tiktok"],
  instagram: ["instagram"],
};

export default async function GlobalFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string | string[] }>;
}) {
  const activeKey = resolveGlobalFeedPlatform((await searchParams).platform);
  const feed = await getGlobalFeed(QUERY_PLATFORMS[activeKey], 24);

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:pt-10">
        <header lang="en" className="max-w-3xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Global feed
          </p>
          <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
            See what the world is remixing
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Browse reviewed platform sources. Detail links open Korean MemeCatch pages with context and safety notes.
          </p>
        </header>

        <GlobalFeedTabs activeKey={activeKey} feed={feed} />
      </div>
    </main>
  );
}
