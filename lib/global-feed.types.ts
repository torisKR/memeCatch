/**
 * 글로벌 피드 공개 타입 — 서버(lib/global-feed.server.ts)와 클라이언트
 * 컴포넌트(components/global-feed/*)가 함께 읽는 순수 타입 모듈.
 * server-only 의존이 없으므로 양쪽에서 값·타입 모두 import 가능하다.
 */
import type { SocialPlatform } from "@/lib/source-platform";
import type { MemeCountryCode } from "@/lib/meme-country";

/** 피드 탭 키. YouTube 탭은 youtube + youtube_shorts를 함께 담는다. */
export type FeedPlatformKey = "youtube" | "tiktok" | "instagram";

export type GlobalFeedStatus = "ready" | "empty" | "error";

export type GlobalFeedItem = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  safety_level: string;
  lifecycle_status: string;
  media_type: string;
  origin_year: number | null;
  trend_score: number | null;
  origin_country_code: MemeCountryCode | null;
  /** 대표 콘텐츠의 플랫폼(youtube/youtube_shorts/tiktok/instagram) */
  platform: SocialPlatform;
  content_url: string | null;
  thumbnail_url: string | null;
};

export type GlobalFeedResult = {
  status: GlobalFeedStatus;
  items: GlobalFeedItem[];
};

export function resolveGlobalFeedPlatform(
  value: string | string[] | undefined,
): FeedPlatformKey {
  return value === "tiktok" || value === "instagram" ? value : "youtube";
}
