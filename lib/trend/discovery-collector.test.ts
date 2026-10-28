import { describe, expect, it, vi } from "vitest";
import {
  collectYouTubeDiscovery,
  type CollectYouTubeDiscoveryInput,
  type YouTubeSourcePolicy,
} from "./discovery-collector";

const policy: YouTubeSourcePolicy = {
  key: "youtube.discovery.v1",
  enabled: true,
  derivedAnalysisAllowed: true,
  collectableFields: [
    "title",
    "description",
    "channel_id",
    "published_at",
    "duration",
    "statistics.view_count",
    "statistics.like_count",
    "statistics.comment_count",
    "status.privacy_status",
    "status.embeddable",
  ],
  approvalBasis: "YouTube Data API developer policies reviewed",
  verifiedAt: "2026-10-13T00:00:00.000Z",
  retentionDays: 30,
};

function baseInput(overrides: Partial<CollectYouTubeDiscoveryInput> = {}): CollectYouTubeDiscoveryInput {
  return {
    apiKey: "test-key",
    sourcePolicy: policy,
    lanes: {
      new_discovery: {
        callBudget: 4,
        seeds: [{ id: "new-1", query: "밈 챌린지" }],
      },
      candidate_tracking: {
        callBudget: 0,
        seeds: [],
      },
    },
    reserveCall: vi.fn(async () => true),
    now: vi.fn()
      .mockReturnValueOnce(new Date("2026-10-13T01:00:00.000Z"))
      .mockReturnValue(new Date("2026-10-13T01:00:01.000Z")),
    ...overrides,
  };
}

function searchResponse(items: Array<{ id: string; title: string; description?: string; channelId?: string }>, nextPageToken?: string) {
  return new Response(JSON.stringify({
    nextPageToken,
    items: items.map((item) => ({
      id: { videoId: item.id },
      snippet: {
        title: item.title,
        description: item.description ?? "",
        channelId: item.channelId ?? "channel-1",
        publishedAt: "2026-10-12T00:00:00Z",
      },
    })),
  }));
}

function videosResponse(items: Array<{ id: string; title: string; description?: string; statistics?: Record<string, string> }>) {
  return new Response(JSON.stringify({
    items: items.map((item) => ({
      id: item.id,
      snippet: {
        title: item.title,
        description: item.description ?? "",
        channelId: "channel-1",
        publishedAt: "2026-10-12T00:00:00Z",
      },
      contentDetails: { duration: "PT1M30S" },
      statistics: item.statistics,
      status: { privacyStatus: "public", embeddable: true },
    })),
  }));
}

describe("collectYouTubeDiscovery", () => {
  it("stays disabled without both an API key and an enabled policy", async () => {
    const noKeyFetch = vi.fn();
    const noKey = await collectYouTubeDiscovery(baseInput({ apiKey: "", fetch: noKeyFetch }));
    expect(noKey).toMatchObject({ status: "disabled", disabledReason: "missing_api_key", records: [] });
    expect(noKeyFetch).not.toHaveBeenCalled();

    const disabledFetch = vi.fn();
    const disabled = await collectYouTubeDiscovery(baseInput({
      sourcePolicy: { ...policy, enabled: false },
      fetch: disabledFetch,
    }));
    expect(disabled).toMatchObject({ status: "disabled", disabledReason: "source_policy_disabled" });
    expect(disabledFetch).not.toHaveBeenCalled();
  });

  it("reserves every search and videos request before calling the official API", async () => {
    const events: string[] = [];
    const reserveCall = vi.fn(async ({ method }: { method: string }) => {
      events.push(`reserve:${method}`);
      return true;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const method = url.pathname.endsWith("/search") ? "search.list" : "videos.list";
      events.push(`fetch:${method}`);
      expect(url.hostname).toBe("www.googleapis.com");
      expect(url.pathname).toMatch(/^\/youtube\/v3\/(search|videos)$/u);
      return method === "search.list"
        ? searchResponse([{ id: "video-1", title: "#새밈 테스트" }])
        : videosResponse([{ id: "video-1", title: "#새밈 테스트", statistics: {
          viewCount: "9007199254740993",
          likeCount: "0",
          commentCount: "12",
        } }]);
    });

    const result = await collectYouTubeDiscovery(baseInput({ fetch: fetchMock, reserveCall }));

    expect(events).toEqual([
      "reserve:search.list",
      "fetch:search.list",
      "reserve:videos.list",
      "fetch:videos.list",
    ]);
    expect(result.callsUsed.new_discovery).toBe(2);
    expect(result.records[0]).toMatchObject({
      platformContentId: "video-1",
      sourcePublishedAt: "2026-10-12T00:00:00Z",
      firstDiscoveredAt: "2026-10-13T01:00:00.000Z",
      measuredAt: "2026-10-13T01:00:01.000Z",
      metadataExpiresAt: "2026-11-12T01:00:01.000Z",
      durationSeconds: 90,
      embeddable: true,
      verificationStatus: "verified",
      rawMetrics: {
        viewCount: { value: "9007199254740993", missingReason: null },
        likeCount: { value: "0", missingReason: null },
      },
    });
    const videosUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(videosUrl.searchParams.get("part")).toBe("snippet,contentDetails,status,statistics");
    expect(videosUrl.searchParams.has("videoDuration")).toBe(false);
  });

  it("keeps discovery and tracking budgets independent and bounds paging", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search")) {
        return searchResponse([], "another-page");
      }
      return videosResponse([]);
    });
    const result = await collectYouTubeDiscovery(baseInput({
      fetch: fetchMock,
      maxPagesPerSeed: 5,
      lanes: {
        new_discovery: { callBudget: 1, seeds: [{ id: "new", query: "새 밈" }] },
        candidate_tracking: { callBudget: 2, seeds: [{ id: "track", query: "관찰 밈" }] },
      },
    }));

    expect(result.callsUsed).toEqual({ new_discovery: 1, candidate_tracking: 2 });
    expect(result.budgetExhausted).toEqual({ new_discovery: true, candidate_tracking: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const queries = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("q"));
    expect(queries).toEqual(["새 밈", "관찰 밈", "관찰 밈"]);
  });

  it("does not issue a request when the atomic reservation is denied", async () => {
    const fetchMock = vi.fn();
    const reserveCall = vi.fn(async () => false);
    const result = await collectYouTubeDiscovery(baseInput({ fetch: fetchMock, reserveCall }));

    expect(reserveCall).toHaveBeenCalledExactlyOnceWith({
      lane: "new_discovery",
      method: "search.list",
      seedId: "new-1",
      page: 1,
      callCount: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "partial",
      records: [],
      callsUsed: { new_discovery: 0, candidate_tracking: 0 },
      budgetExhausted: { new_discovery: true, candidate_tracking: false },
    });
  });

  it("records missing statistics and API failures as null with explicit reasons", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([
        { id: "missing-stat", title: "첫 영상" },
        { id: "missing-video", title: "둘째 영상" },
      ]))
      .mockResolvedValueOnce(videosResponse([
        { id: "missing-stat", title: "첫 영상", statistics: { viewCount: "0" } },
      ]));
    const result = await collectYouTubeDiscovery(baseInput({ fetch: fetchMock }));

    expect(result.records.find((record) => record.platformContentId === "missing-stat")?.rawMetrics).toEqual({
      viewCount: { value: "0", missingReason: null },
      likeCount: { value: null, missingReason: "not_returned_by_provider" },
      commentCount: { value: null, missingReason: "not_returned_by_provider" },
    });
    expect(result.records.find((record) => record.platformContentId === "missing-video")).toMatchObject({
      verificationStatus: "video_unavailable_or_private",
      rawMetrics: {
        viewCount: { value: null, missingReason: "video_unavailable_or_private" },
      },
    });

    const failedFetch = vi.fn()
      .mockResolvedValueOnce(searchResponse([{ id: "failed", title: "실패 후보" }]))
      .mockResolvedValueOnce(new Response("quota", { status: 403 }));
    const failed = await collectYouTubeDiscovery(baseInput({ fetch: failedFetch }));
    expect(failed.status).toBe("partial");
    expect(failed.failures).toEqual([expect.objectContaining({
      method: "videos.list",
      reason: "http_error",
      httpStatus: 403,
    })]);
    expect(failed.records[0].rawMetrics.viewCount).toEqual({
      value: null,
      missingReason: "videos_list_failed",
    });
  });

  it("extracts only repeated unknown terms from collected bounded text", async () => {
    const longDescription = `${"가".repeat(250)} #뒤쪽태그`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([
        { id: "a", title: "#새표현 \"반복 드립\"", description: longDescription },
        { id: "b", title: "#새표현 \"반복 드립\" #기존밈" },
        { id: "c", title: "#한번뿐" },
      ]))
      .mockResolvedValueOnce(videosResponse([
        { id: "a", title: "#새표현 \"반복 드립\"", description: longDescription },
        { id: "b", title: "#새표현 \"반복 드립\" #기존밈" },
        { id: "c", title: "#한번뿐" },
      ]));
    const result = await collectYouTubeDiscovery(baseInput({
      fetch: fetchMock,
      maxDescriptionChars: 100,
      knownPhrases: ["기존밈"],
    }));

    expect(result.records[0].description).toHaveLength(100);
    expect(result.candidateTerms).toEqual([
      {
        normalizedPhrase: "반복 드립",
        displayName: "반복 드립",
        source: "quoted_phrase",
        platformContentIds: ["a", "b"],
      },
      {
        normalizedPhrase: "새표현",
        displayName: "새표현",
        source: "hashtag",
        platformContentIds: ["a", "b"],
      },
    ]);
  });

  it("filters generic format tags and the discovery query itself", async () => {
    const title = "#쇼츠 #shorts #밈 #memes #패러디 #웃긴영상 #반전 #챌린지 #고양이점프";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([
        { id: "a", title },
        { id: "b", title },
      ]))
      .mockResolvedValueOnce(videosResponse([
        { id: "a", title },
        { id: "b", title },
      ]));

    const result = await collectYouTubeDiscovery(baseInput({ fetch: fetchMock }));

    expect(result.candidateTerms).toEqual([{
      normalizedPhrase: "고양이점프",
      displayName: "고양이점프",
      source: "hashtag",
      platformContentIds: ["a", "b"],
    }]);
  });

  it.each([false, undefined])(
    "keeps raw-only metadata verbatim and suppresses candidate extraction when derived analysis is %s",
    async (derivedAnalysisAllowed) => {
      const title = "  Ｆｕｌｌ－ｗｉｄｔｈ   #새표현  ";
      const description = "첫 줄\n\n  둘째 줄 #새표현";
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/search")) {
          expect(url.searchParams.get("maxResults")).toBe("25");
          return searchResponse([
            { id: "raw-a", title, description },
            { id: "raw-b", title, description },
          ], "must-not-fetch-page-two");
        }
        return videosResponse([
          { id: "raw-a", title, description, statistics: { viewCount: "1" } },
          { id: "raw-b", title, description, statistics: { viewCount: "2" } },
        ]);
      });

      const result = await collectYouTubeDiscovery(baseInput({
        sourcePolicy: { ...policy, derivedAnalysisAllowed },
        fetch: fetchMock,
        maxPagesPerSeed: 5,
        maxResultsPerPage: 50,
      }));

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.records[0]).toMatchObject({ title, description });
      expect(result.candidateTerms).toEqual([]);
    },
  );

  it("does not infer Shorts or calculate a score from search results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(searchResponse([{ id: "short-looking", title: "세로 영상 #챌린지" }]))
      .mockResolvedValueOnce(videosResponse([{
        id: "short-looking",
        title: "세로 영상 #챌린지",
        statistics: { viewCount: "100", likeCount: "20", commentCount: "3" },
      }]));
    const result = await collectYouTubeDiscovery(baseInput({ fetch: fetchMock }));
    const record = result.records[0] as unknown as Record<string, unknown>;
    expect(record.platform).toBeUndefined();
    expect(record.isShort).toBeUndefined();
    expect(record.score).toBeUndefined();
    expect(record.rawMetrics).toBeDefined();
  });
});
