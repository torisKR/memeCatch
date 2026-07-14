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
  is_representative?: boolean | null;
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
  if (
    value.includes("youtube shorts") ||
    value.includes("youtube.com/shorts/") ||
    value.includes("youtu.be/shorts/")
  ) {
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

/** 대표 콘텐츠를 먼저 정렬하고, 같은 플랫폼은 한 번만 카드 라벨로 사용한다. */
export function sourcePlatformsFromMeme({
  contents = [],
  sources = [],
}: {
  contents?: PlatformReference[] | null;
  sources?: PlatformReference[] | null;
}): SourcePlatform[] {
  const contentReferences = [...(contents ?? [])].sort(
    (a, b) => Number(Boolean(b.is_representative)) - Number(Boolean(a.is_representative))
  );
  const sourceReferences = sources ?? [];
  const platforms = [...contentReferences, ...sourceReferences]
    .map(sourcePlatformFromReference)
    .filter((platform): platform is SourcePlatform => Boolean(platform));
  return [...new Set(platforms)];
}

/** 단일 라벨만 필요한 기존 호출부를 위한 대표 플랫폼. */
export function sourcePlatformFromMeme(args: {
  contents?: PlatformReference[] | null;
  sources?: PlatformReference[] | null;
}): SourcePlatform | null {
  return sourcePlatformsFromMeme(args)[0] ?? null;
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
