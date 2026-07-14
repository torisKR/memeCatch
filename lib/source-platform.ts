export const SOCIAL_PLATFORM_KEYS = [
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORM_KEYS)[number];

export type SourcePlatform = SocialPlatform | "community" | "other";

export type PlatformReference = {
  platform?: string | null;
  url?: string | null;
};

export const SOURCE_PLATFORM_META: Record<SourcePlatform, { label: string }> = {
  youtube: { label: "YouTube" },
  youtube_shorts: { label: "YouTube Shorts" },
  tiktok: { label: "TikTok" },
  instagram: { label: "Instagram" },
  community: { label: "커뮤니티" },
  other: { label: "원본 출처" },
};

/** 콘텐츠 URL을 우선해 카드에 표시할 출처 플랫폼을 안정적으로 정규화한다. */
export function sourcePlatformFromReference(
  reference?: PlatformReference | null
): SourcePlatform | null {
  if (!reference) return null;
  const value = `${reference.platform ?? ""} ${reference.url ?? ""}`.toLowerCase();
  if (value.includes("youtube.com/shorts/") || value.includes("youtu.be/shorts/")) {
    return "youtube_shorts";
  }
  if (value.includes("youtube") || value.includes("youtu.be")) return "youtube";
  if (value.includes("tiktok") || value.includes("틱톡")) return "tiktok";
  if (value.includes("instagram") || value.includes("인스타")) return "instagram";
  if (
    value.includes("community") ||
    value.includes("커뮤니티") ||
    value.includes("디시") ||
    value.includes("dcinside")
  ) {
    return "community";
  }
  return value.trim() ? "other" : null;
}

/** 대표 콘텐츠가 있으면 그것을, 없으면 출처 레코드를 카드 라벨로 사용한다. */
export function sourcePlatformFromMeme({
  contents = [],
  sources = [],
}: {
  contents?: PlatformReference[] | null;
  sources?: PlatformReference[] | null;
}): SourcePlatform | null {
  const contentReferences = contents ?? [];
  const sourceReferences = sources ?? [];
  return (
    contentReferences.map(sourcePlatformFromReference).find(Boolean) ??
    sourceReferences.map(sourcePlatformFromReference).find(Boolean) ??
    null
  );
}

export function isSocialPlatform(value: string | undefined): value is SocialPlatform {
  return SOCIAL_PLATFORM_KEYS.some((platform) => platform === value);
}
