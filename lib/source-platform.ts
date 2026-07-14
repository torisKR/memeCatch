export const SOCIAL_PLATFORM_KEYS = [
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORM_KEYS)[number];
export type SocialPlatformCounts = Record<SocialPlatform, number>;

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

export function emptySocialPlatformCounts(): SocialPlatformCounts {
  return { youtube: 0, youtube_shorts: 0, tiktok: 0, instagram: 0 };
}

/** 공개 콘텐츠 행을 밈 단위로 세어 탐색 필터의 실제 수량을 만든다. */
export function countSocialPlatformReferences(
  references: Array<PlatformReference & { meme_id: string }>
): SocialPlatformCounts {
  const ids = {
    youtube: new Set<string>(),
    youtube_shorts: new Set<string>(),
    tiktok: new Set<string>(),
    instagram: new Set<string>(),
  };

  for (const reference of references) {
    const platform = sourcePlatformFromReference(reference);
    if (platform && isSocialPlatform(platform)) ids[platform].add(reference.meme_id);
  }

  return {
    youtube: ids.youtube.size,
    youtube_shorts: ids.youtube_shorts.size,
    tiktok: ids.tiktok.size,
    instagram: ids.instagram.size,
  };
}
