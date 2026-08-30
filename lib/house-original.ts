/**
 * House-original provenance helpers.
 *
 *   pending --> fact_checking --> rights_checking
 *                                      |
 *                         publish_house_original RPC
 *                                      |
 *                            approved or limited
 *                                      |
 *              copy / source / media edit --> rights_checking
 *
 * Catalog rows keep the existing moderation machine. Branch on origin_kind
 * only through this module.
 */

import { memePathFrom, ORIGIN_KIND } from "@/lib/labels";

export const CATALOG_ORIGIN = "catalog" as const;
export const HOUSE_ORIGINAL = "house_original" as const;
export type OriginKind = typeof CATALOG_ORIGIN | typeof HOUSE_ORIGINAL;

export const HOUSE_ORIGINAL_SOURCE_ROLE = "original" as const;
export const HOUSE_ORIGINAL_RIGHTS_BASIS = "creator_permission" as const;

export type HouseOriginalRightsSource = {
  source_role?: string | null;
  rights_basis?: string | null;
  source_url?: string | null;
};

export type HouseOriginalPublishEvidence = {
  originKind: string | null | undefined;
  houseRightsAttestedAt: string | null | undefined;
  sources: HouseOriginalRightsSource[];
};

export function isHouseOriginal(originKind: string | null | undefined): boolean {
  return originKind === HOUSE_ORIGINAL;
}

export function isHouseOriginalRightsSource(source: HouseOriginalRightsSource): boolean {
  const url = source.source_url?.trim() ?? "";
  return (
    source.source_role === HOUSE_ORIGINAL_SOURCE_ROLE &&
    source.rights_basis === HOUSE_ORIGINAL_RIGHTS_BASIS &&
    /^https?:\/\//i.test(url)
  );
}

export function canPublishHouseOriginal(input: HouseOriginalPublishEvidence): boolean {
  if (!isHouseOriginal(input.originKind)) return false;
  if (!input.houseRightsAttestedAt) return false;
  return input.sources.some(isHouseOriginalRightsSource);
}

export type TrustCopyKind = "house_original" | "catalog";

export function trustCopyKind(originKind: string | null | undefined): TrustCopyKind {
  return isHouseOriginal(originKind) ? "house_original" : "catalog";
}

export function houseOriginalPublicLabel(): string {
  return ORIGIN_KIND.house_original.user;
}

export function houseOriginalCanonicalUrl(shortId: string, slug: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com").replace(/\/$/, "");
  return `${site}${memePathFrom(shortId, slug)}`;
}

export function houseOriginalPublishErrorMessage(raw: string): string {
  if (raw.includes("house_rights_attestation_required")) {
    return "자체 제작 권리 확인에 동의해 주세요.";
  }
  if (raw.includes("house_original_rights_required")) {
    return "자체 제작 권리 근거(원본·제작 허가 출처)가 없어 게시할 수 없어요.";
  }
  if (raw.includes("house_original_insert_not_pending")) {
    return "자체 제작 밈은 대기 상태로만 만들 수 있어요.";
  }
  if (raw.includes("house_original_origin_kind_immutable")) {
    return "자체 제작 구분은 만든 뒤에 바꿀 수 없어요.";
  }
  if (raw.includes("house_original_required")) {
    return "이 전이는 자체 제작 밈에만 쓸 수 있어요.";
  }
  if (raw.includes("invalid moderation transition")) {
    return "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요.";
  }
  return raw;
}
