import type { ContentDepthInput } from "@/lib/content-depth";

export const MARKET_PASSPORT_ROLES = ["origin", "adopted", "active"] as const;
export type MarketPassportRole = (typeof MARKET_PASSPORT_ROLES)[number];

export const MARKET_VARIANT_RELATIONS = [
  "derived_from",
  "local_variant",
  "local_equivalent",
] as const;
export type MarketVariantRelation = (typeof MARKET_VARIANT_RELATIONS)[number];

export const MARKET_PASSPORT_DATA_STATUSES = ["reviewed", "empty", "unavailable"] as const;
export type MarketPassportDataStatus = (typeof MARKET_PASSPORT_DATA_STATUSES)[number];

export type MarketPassportProfile = {
  memeId: string;
  marketCode: string;
  languageTag: string;
  role: MarketPassportRole;
  localTitle: string;
  localAliases: string[];
  usageNote: string | null;
  caution: string | null;
};

export type MarketPassportVariant = {
  id: string;
  targetMemeId: string;
  targetShortId: string;
  targetSlug: string;
  targetTitle: string;
  targetHref: string;
  relation: MarketVariantRelation;
};

export type MemeMarketPassport = {
  origin: MarketPassportProfile | null;
  profiles: MarketPassportProfile[];
  variants: MarketPassportVariant[];
  hasReviewedData?: boolean;
  dataStatus?: MarketPassportDataStatus;
};

export type MarketPassportProfileRow = {
  meme_id: string;
  market_code: string;
  language_tag: string;
  role: string;
  local_title: string;
  local_aliases: string[];
  usage_note: string | null;
  caution: string | null;
  review_state: string;
};

export type MarketPassportVariantRow = {
  id: string;
  target_meme_id: string;
  relation_kind: string;
  review_state: string;
};

export type MarketPassportTargetRow = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  href?: string;
};

type BuildMemeMarketPassportInput = {
  memeId: string;
  profiles: readonly MarketPassportProfileRow[];
  variants: readonly MarketPassportVariantRow[];
  targets: readonly MarketPassportTargetRow[];
};

function toProfile(row: MarketPassportProfileRow): MarketPassportProfile | null {
  if (
    row.review_state !== "reviewed" ||
    !MARKET_PASSPORT_ROLES.includes(row.role as MarketPassportRole) ||
    !row.market_code ||
    !row.language_tag ||
    !row.local_title.trim()
  ) {
    return null;
  }
  return {
    memeId: row.meme_id,
    marketCode: row.market_code,
    languageTag: row.language_tag,
    role: row.role as MarketPassportRole,
    localTitle: row.local_title,
    localAliases: row.local_aliases ?? [],
    usageNote: row.usage_note,
    caution: row.caution,
  };
}

export function buildMemeMarketPassport({
  memeId,
  profiles,
  variants,
  targets,
}: BuildMemeMarketPassportInput): MemeMarketPassport {
  const visibleProfiles = profiles
    .map(toProfile)
    .filter((profile): profile is MarketPassportProfile => profile !== null)
    .filter((profile) => profile.memeId === memeId);
  const origin = visibleProfiles.find((profile) => profile.role === "origin") ?? null;
  const orderedProfiles = [...visibleProfiles].sort(
    (left, right) =>
      Number(right.role === "active") - Number(left.role === "active") ||
      left.marketCode.localeCompare(right.marketCode),
  );
  const targetsById = new Map(targets.map((target) => [target.id, target]));
  const visibleVariants = variants.flatMap((variant) => {
    if (
      variant.review_state !== "reviewed" ||
      !MARKET_VARIANT_RELATIONS.includes(variant.relation_kind as MarketVariantRelation)
    ) {
      return [];
    }
    const target = targetsById.get(variant.target_meme_id);
    const targetHref = target?.href?.trim();
    if (!target || target.id === memeId || !targetHref) return [];
    return [
      {
        id: variant.id,
        targetMemeId: target.id,
        targetShortId: target.short_id,
        targetSlug: target.slug,
        targetTitle: target.title,
        targetHref,
        relation: variant.relation_kind as MarketVariantRelation,
      },
    ];
  });

  return {
    origin,
    profiles: orderedProfiles,
    variants: visibleVariants,
    hasReviewedData: visibleProfiles.length > 0 || visibleVariants.length > 0,
  };
}

export function marketName(
  marketCode: string,
  names: Record<string, string>,
): string {
  return names[marketCode] ?? marketCode;
}

export function relationLabel(
  relation: MarketVariantRelation,
  labels: Record<MarketVariantRelation, string>,
): string {
  return labels[relation];
}
