import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createInstagramHashtagConnector,
  createThreadsTextConnector,
  createXTextConnector,
} from "@/lib/trend/radar-platform-connectors.server";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const context = {
  cursor: null,
  attemptedAt: "2026-08-12T00:00:00.000Z",
  signal: new AbortController().signal,
};

describe("official social Radar connectors", () => {
  it("requests X posts without media and emits text-only metadata", async () => {
    process.env.X_API_BEARER_TOKEN = "secret";
    process.env.RADAR_X_TERMS = "냥밈";
    const fetch = vi.fn(async (input: URL | RequestInfo) => {
      void input;
      return response({
        data: [
          {
            id: "x-1",
            text: "냥밈 #고양이",
            created_at: "2026-08-12T00:00:00Z",
            lang: "ko",
          },
        ],
      });
    });

    const result = await createXTextConnector({ fetch }).collect(context);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));

    expect(url.searchParams.get("query")).toContain("-has:media");
    expect(url.searchParams.get("tweet.fields")).toBe("created_at,lang");
    expect(url.searchParams.has("expansions")).toBe(false);
    expect(result.signals[0]).toMatchObject({
      platform: "x",
      signalKind: "text_mention",
      rightsMode: "link_only",
      text: "냥밈 #고양이",
    });
    expect(result.signals[0]?.metadata).toBeUndefined();
    expect(result.signals[0]?.metrics).toBeUndefined();
  });

  it("uses the latest X post id as the next since_id", async () => {
    process.env.X_API_BEARER_TOKEN = "secret";
    process.env.RADAR_X_TERMS = "냥밈";
    const fetch = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("since_id")).toBe("previous-post");
      expect(url.searchParams.has("next_token")).toBe(false);
      return response({ data: [], meta: { newest_id: "latest-post" } });
    });

    const result = await createXTextConnector({ fetch }).collect({
      ...context,
      cursor: "previous-post",
    });

    expect(result.cursor).toBe("latest-post");
  });

  it("uses the Threads TEXT filter and drops non-text responses defensively", async () => {
    process.env.THREADS_ACCESS_TOKEN = "secret";
    process.env.RADAR_THREADS_TERMS = "냥밈";
    const fetch = vi.fn(async (input: URL | RequestInfo) => {
      void input;
      return response({
        data: [
          { id: "t-1", text: "냥밈", media_type: "TEXT_POST", permalink: "https://threads.net/t-1", timestamp: "2026-08-12T00:00:00Z" },
          { id: "t-2", text: "video", media_type: "VIDEO", permalink: "https://threads.net/t-2" },
        ],
      });
    });

    const result = await createThreadsTextConnector({ fetch }).collect(context);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));

    expect(url.searchParams.get("media_type")).toBe("TEXT");
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({
      platform: "threads",
      platformContentId: "t-1",
      signalKind: "text_mention",
      rightsMode: "link_only",
    });
  });

  it("collects Instagram hashtag media metadata without requesting or storing media URLs", async () => {
    process.env.META_INSTAGRAM_ACCESS_TOKEN = "secret";
    process.env.META_INSTAGRAM_USER_ID = "ig-user";
    process.env.RADAR_INSTAGRAM_HASHTAGS = "냥밈";
    process.env.META_GRAPH_API_VERSION = "v26.0";
    const fetch = vi
      .fn((input: URL | RequestInfo) => {
        void input;
        return Promise.resolve(response({}));
      })
      .mockResolvedValueOnce(response({ data: [{ id: "hashtag-1" }] }))
      .mockResolvedValueOnce(
        response({
          data: [
            {
              id: "ig-1",
              caption: "냥밈 #고양이",
              media_type: "VIDEO",
              permalink: "https://www.instagram.com/reel/ig-1/",
              timestamp: "2026-08-12T00:00:00Z",
              like_count: 5,
              comments_count: 2,
            },
          ],
        }),
      );

    const result = await createInstagramHashtagConnector({ fetch }).collect(context);
    const mediaUrl = new URL(String(fetch.mock.calls[1]?.[0]));

    expect(mediaUrl.searchParams.get("fields")).not.toContain("media_url");
    expect(result.signals[0]).toMatchObject({
      platform: "instagram",
      signalKind: "instagram_media",
      canonicalUrl: "https://www.instagram.com/reel/ig-1/",
      metadata: { media_type: "VIDEO" },
      rightsMode: "api_metadata",
    });
  });

  it("keeps successful Instagram hashtags when a peer hashtag fails", async () => {
    process.env.META_INSTAGRAM_ACCESS_TOKEN = "secret";
    process.env.META_INSTAGRAM_USER_ID = "ig-user";
    process.env.RADAR_INSTAGRAM_HASHTAGS = "실패태그,냥밈";
    const fetch = vi
      .fn((input: URL | RequestInfo) => {
        const url = new URL(String(input));
        if (url.searchParams.get("q") === "실패태그") {
          return Promise.resolve(new Response("rate limited", { status: 429 }));
        }
        return Promise.resolve(response({}));
      })
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(response({ data: [{ id: "hashtag-1" }] }))
      .mockResolvedValueOnce(
        response({
          data: [
            {
              id: "ig-1",
              caption: "냥밈",
              media_type: "IMAGE",
              permalink: "https://www.instagram.com/p/ig-1/",
              timestamp: "2026-08-12T00:00:00Z",
            },
          ],
        }),
      );

    const result = await createInstagramHashtagConnector({ fetch }).collect(context);

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.platformContentId).toBe("ig-1");
  });
});
