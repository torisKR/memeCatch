import "server-only";

import {
  extractRadarHashtags,
  normalizeRadarHashtag,
  type RawRadarSignal,
} from "@/lib/trend/radar";
import type {
  RadarConnector,
  RadarConnectorRegistry,
} from "@/lib/trend/radar-connectors.server";

type Fetch = typeof fetch;

type ConnectorConfig = {
  fetch?: Fetch;
  now?: () => Date;
};

type XPost = {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
};

type ThreadsPost = {
  id: string;
  text?: string;
  media_type?: "TEXT" | "TEXT_POST" | string;
  permalink?: string;
  timestamp?: string;
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function seeds(name: string, limit: number): string[] {
  return [
    ...new Set(
      (process.env[name] ?? "")
        .split(",")
        .map(normalizeRadarHashtag)
        .filter(Boolean),
    ),
  ].slice(0, limit);
}

async function json<T>(request: Promise<Response>): Promise<T> {
  const response = await request;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function metrics(input?: Record<string, number>): Record<string, number> {
  if (!input) return {};
  const engagement = Object.values(input).reduce((sum, value) => sum + value, 0);
  return { engagement: Math.min(100, Math.log1p(engagement) * 15) };
}

export function createXTextConnector(config: ConnectorConfig = {}): RadarConnector<"x"> {
  const request = config.fetch ?? fetch;
  return {
    platform: "x",
    async collect({ cursor, attemptedAt, signal }) {
      const querySeeds = seeds("RADAR_X_TERMS", 10);
      if (!querySeeds.length) return { signals: [], cursor };
      const url = new URL("https://api.x.com/2/tweets/search/recent");
      url.searchParams.set(
        "query",
        `(${querySeeds.map((term) => `\"${term}\"`).join(" OR ")}) lang:ko -is:retweet -has:media`,
      );
      url.searchParams.set("tweet.fields", "created_at,lang");
      url.searchParams.set("max_results", "25");
      if (cursor) url.searchParams.set("since_id", cursor);
      const body = await json<{ data?: XPost[]; meta?: { newest_id?: string } }>(
        request(url, {
          headers: { authorization: `Bearer ${required("X_API_BEARER_TOKEN")}` },
          cache: "no-store",
          signal,
        }),
      );
      return {
        signals: (body.data ?? []).map<RawRadarSignal>((post) => ({
          platform: "x",
          platformContentId: post.id,
          canonicalUrl: `https://x.com/i/web/status/${post.id}`,
          signalKind: "text_mention",
          text: post.text,
          hashtags: extractRadarHashtags(post.text),
          publishedAt: post.created_at,
          observedAt: post.created_at ?? attemptedAt,
          collectedAt: attemptedAt,
          language: post.lang,
          rightsMode: "link_only",
        })),
        cursor: body.meta?.newest_id ?? cursor,
      };
    },
  };
}

export function createThreadsTextConnector(
  config: ConnectorConfig = {},
): RadarConnector<"threads"> {
  const request = config.fetch ?? fetch;
  return {
    platform: "threads",
    async collect({ attemptedAt, signal }) {
      const querySeeds = seeds("RADAR_THREADS_TERMS", 10);
      const accessToken = required("THREADS_ACCESS_TOKEN");
      const collected: RawRadarSignal[] = [];
      let lastError: unknown;
      let succeeded = 0;
      for (const querySeed of querySeeds) {
        try {
          const url = new URL("https://graph.threads.com/v1.0/keyword_search");
          url.searchParams.set("q", querySeed);
          url.searchParams.set("search_type", "RECENT");
          url.searchParams.set("search_mode", "KEYWORD");
          url.searchParams.set("media_type", "TEXT");
          url.searchParams.set("fields", "id,text,media_type,permalink,timestamp");
          url.searchParams.set("limit", "100");
          const body = await json<{ data?: ThreadsPost[] }>(
            request(url, {
              headers: { authorization: `Bearer ${accessToken}` },
              cache: "no-store",
              signal,
            }),
          );
          collected.push(
            ...(body.data ?? [])
            .filter((post) =>
              (post.media_type === "TEXT" || post.media_type === "TEXT_POST") &&
              post.permalink && post.text && post.timestamp,
            )
            .map<RawRadarSignal>((post) => ({
              platform: "threads",
              platformContentId: post.id,
              canonicalUrl: post.permalink!,
              signalKind: "text_mention",
              querySeed,
              text: post.text,
              hashtags: extractRadarHashtags(post.text ?? ""),
              publishedAt: post.timestamp,
              observedAt: post.timestamp!,
              collectedAt: attemptedAt,
              rightsMode: "link_only",
            })),
          );
          succeeded += 1;
        } catch (error) {
          lastError = error;
        }
      }
      if (!succeeded && lastError) throw lastError;
      return { signals: collected, cursor: null };
    },
  };
}

export function createInstagramHashtagConnector(
  config: ConnectorConfig = {},
): RadarConnector<"instagram"> {
  const request = config.fetch ?? fetch;
  return {
    platform: "instagram",
    async collect({ attemptedAt, signal }) {
      const hashtags = seeds("RADAR_INSTAGRAM_HASHTAGS", 30);
      const accessToken = required("META_INSTAGRAM_ACCESS_TOKEN");
      const userId = required("META_INSTAGRAM_USER_ID");
      const version = process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
      const collected: RawRadarSignal[] = [];
      let lastError: unknown;
      let succeeded = 0;
      for (const querySeed of hashtags) {
        try {
          const searchUrl = new URL(`https://graph.facebook.com/${version}/ig_hashtag_search`);
          searchUrl.searchParams.set("user_id", userId);
          searchUrl.searchParams.set("q", querySeed);
          const search = await json<{ data?: Array<{ id: string }> }>(
            request(searchUrl, {
              headers: { authorization: `Bearer ${accessToken}` },
              cache: "no-store",
              signal,
            }),
          );
          const hashtagId = search.data?.[0]?.id;
          if (!hashtagId) {
            succeeded += 1;
            continue;
          }

          const mediaUrl = new URL(
            `https://graph.facebook.com/${version}/${hashtagId}/recent_media`,
          );
          mediaUrl.searchParams.set("user_id", userId);
          mediaUrl.searchParams.set(
            "fields",
            "id,caption,media_type,permalink,timestamp,like_count,comments_count",
          );
          mediaUrl.searchParams.set("limit", "50");
          const media = await json<{ data?: InstagramMedia[] }>(
            request(mediaUrl, {
              headers: { authorization: `Bearer ${accessToken}` },
              cache: "no-store",
              signal,
            }),
          );
          collected.push(...(media.data ?? []).filter((item) => item.permalink && item.timestamp).map<RawRadarSignal>((item) => ({
            platform: "instagram",
            platformContentId: item.id,
            canonicalUrl: item.permalink!,
            signalKind: "instagram_media",
            querySeed,
            text: item.caption,
            hashtags: extractRadarHashtags(item.caption ?? ""),
            publishedAt: item.timestamp,
            observedAt: item.timestamp!,
            collectedAt: attemptedAt,
            metrics: metrics({
              likes: item.like_count ?? 0,
              comments: item.comments_count ?? 0,
            }),
            rightsMode: "api_metadata",
            metadata: { media_type: item.media_type ?? null },
          })));
          succeeded += 1;
        } catch (error) {
          lastError = error;
        }
      }
      if (!succeeded && lastError) throw lastError;
      return { signals: collected, cursor: null };
    },
  };
}

export function createConfiguredRadarConnectors(
  config: ConnectorConfig = {},
): RadarConnectorRegistry {
  const connectors: RadarConnectorRegistry = {};
  if (process.env.RADAR_X_TERMS?.trim() && process.env.X_API_BEARER_TOKEN?.trim()) {
    connectors.x = createXTextConnector(config);
  }
  if (process.env.RADAR_THREADS_TERMS?.trim() && process.env.THREADS_ACCESS_TOKEN?.trim()) {
    connectors.threads = createThreadsTextConnector(config);
  }
  if (
    process.env.RADAR_INSTAGRAM_HASHTAGS?.trim() &&
    process.env.META_INSTAGRAM_ACCESS_TOKEN?.trim() &&
    process.env.META_INSTAGRAM_USER_ID?.trim()
  ) {
    connectors.instagram = createInstagramHashtagConnector(config);
  }
  return connectors;
}
