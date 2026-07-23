import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPublishableCandidate,
  parseIso8601Duration,
} from "./youtube.server";

// server-only 패키지는 vitest 환경에서 import만으로 실패하지 않도록
// 테스트 러너가 모킹한다(vitest.config의 alias 아래 server-only는 빈 모듈).
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseIso8601Duration", () => {
  it("시·분·초를 초 단위로 변환한다", () => {
    expect(parseIso8601Duration("PT1H2M3S")).toBe(3723);
    expect(parseIso8601Duration("PT59S")).toBe(59);
    expect(parseIso8601Duration("PT10M")).toBe(600);
    expect(parseIso8601Duration("PT0S")).toBe(0);
  });

  it("잘못된 값은 null이다", () => {
    expect(parseIso8601Duration(undefined)).toBeNull();
    expect(parseIso8601Duration("1시간")).toBeNull();
    expect(parseIso8601Duration("")).toBeNull();
  });
});

describe("fetchYouTubeVideoStatuses", () => {
  it("50개씩 배치로 요청하고 ID를 매핑한다", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    const { fetchYouTubeVideoStatuses } = await import("./youtube.server");

    const ids = Array.from({ length: 51 }, (_, i) => `video-${i}`);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const requested = (url.searchParams.get("id") ?? "").split(",");
      return new Response(
        JSON.stringify({
          items: requested.map((id) => ({
            id,
            snippet: {
              title: `t-${id}`,
              channelId: "ch",
              channelTitle: "채널",
              publishedAt: "2021-05-01T00:00:00Z",
              thumbnails: { high: { url: "https://i.ytimg.com/vi/x/hq.jpg" } },
            },
            contentDetails: { duration: "PT1M30S" },
            status: {
              privacyStatus: "public",
              license: "youtube",
              embeddable: true,
              madeForKids: false,
            },
          })),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchYouTubeVideoStatuses(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(51);
    expect(result.get("video-0")).toMatchObject({
      title: "t-video-0",
      durationSeconds: 90,
      privacyStatus: "public",
      embeddable: true,
    });
  });

  it("API 오류를 그대로 드러낸다", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    const { fetchYouTubeVideoStatuses } = await import("./youtube.server");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("quota", { status: 403 })),
    );
    await expect(fetchYouTubeVideoStatuses(["a".repeat(11)])).rejects.toThrow(
      /403/,
    );
  });
});

describe("isPublishableCandidate", () => {
  const base = {
    id: "x",
    title: null,
    channelId: null,
    channelTitle: null,
    publishedAt: null,
    thumbnailUrl: null,
    durationSeconds: null,
    license: null,
    madeForKids: null,
    regionBlocked: null,
  };

  it("공개+임베드 가능만 승격한다", () => {
    expect(
      isPublishableCandidate({ ...base, privacyStatus: "public", embeddable: true }),
    ).toBe(true);
    expect(
      isPublishableCandidate({ ...base, privacyStatus: "public", embeddable: false }),
    ).toBe(false);
    expect(
      isPublishableCandidate({ ...base, privacyStatus: "unlisted", embeddable: true }),
    ).toBe(false);
  });
});
