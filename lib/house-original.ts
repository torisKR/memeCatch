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

/** Admin list `?origin=` — house originals only. Other values are ignored. */
export function parseAdminOriginFilter(
  value: string | undefined,
): typeof HOUSE_ORIGINAL | null {
  return value === HOUSE_ORIGINAL ? HOUSE_ORIGINAL : null;
}

export function originSectionHeading(originKind: string | null | undefined): string {
  return isHouseOriginal(originKind) ? "어떻게 만들었나요?" : "어디서 시작됐어요?";
}

export function adminLinkedContentsEmptyCopy(originKind: string | null | undefined): string {
  if (isHouseOriginal(originKind)) {
    return "자체 제작은 SNS 후보 랭킹으로 들어오지 않습니다. 필요하면 운영자가 직접 임베드를 연결하세요. 자동 게시하지 않습니다.";
  }
  return "연결된 SNS 임베드가 아직 없어요. 검토 파이프라인에서 후보를 승격하면 여기에 표시돼요.";
}

export function adminMemeListEmptyState(input: {
  originFilter: typeof HOUSE_ORIGINAL | null;
  qualityQueue: boolean;
}): { title: string; body: string; actionHref?: string; actionLabel?: string } {
  if (input.originFilter === HOUSE_ORIGINAL) {
    return {
      title: "자체 제작 항목이 없어요",
      body: "밈캐치가 만든 사전 행만 여기에 모입니다. 인터넷 밈 카탈로그와 섞지 않습니다.",
      actionHref: "/admin/memes/new",
      actionLabel: "자체 제작 등록",
    };
  }
  if (input.qualityQueue) {
    return {
      title: "조건에 맞는 밈이 없어요",
      body: "무출처 공개 문서가 없거나, 검색어·상태 필터를 바꿔 보세요.",
    };
  }
  return {
    title: "조건에 맞는 밈이 없어요",
    body: "검색어나 상태 필터를 바꿔 보세요.",
  };
}

export const HOUSE_ORIGINAL_PATH_STEPS = [
  "pending",
  "fact_checking",
  "rights_checking",
  "attested_publish",
] as const;

export type HouseOriginalPathStepId = (typeof HOUSE_ORIGINAL_PATH_STEPS)[number];
export type HouseOriginalPathStepState = "done" | "current" | "upcoming" | "blocked";

export type HouseOriginalPathStep = {
  id: HouseOriginalPathStepId;
  label: string;
  stateLabel: string;
  state: HouseOriginalPathStepState;
};

const PATH_LABELS: Record<HouseOriginalPathStepId, string> = {
  pending: "대기",
  fact_checking: "사실 확인",
  rights_checking: "권리 확인",
  attested_publish: "수동 게시",
};

const PATH_STATE_LABELS: Record<HouseOriginalPathStepState, string> = {
  done: "완료",
  current: "진행",
  upcoming: "남음",
  blocked: "중단",
};

/** pending → fact → rights → attested publish. Publish is never implied by create. */
export function houseOriginalOperatorPath(
  status: string | null | undefined,
): HouseOriginalPathStep[] {
  const published = status === "approved" || status === "limited";
  const rejected = status === "rejected";
  const currentIndex = published
    ? HOUSE_ORIGINAL_PATH_STEPS.length
    : status === "fact_checking"
      ? 1
      : status === "rights_checking"
        ? 2
        : 0;

  return HOUSE_ORIGINAL_PATH_STEPS.map((id, i) => {
    let state: HouseOriginalPathStepState;
    if (rejected) {
      state = id === "attested_publish" ? "blocked" : i === 0 ? "done" : "upcoming";
    } else if (published || i < currentIndex) {
      state = "done";
    } else if (i === currentIndex) {
      state = "current";
    } else {
      state = "upcoming";
    }
    return {
      id,
      label: PATH_LABELS[id],
      stateLabel: PATH_STATE_LABELS[state],
      state,
    };
  });
}

export function houseOriginalPathNote(): string {
  return "대기 → 사실 확인 → 권리 확인 → 운영자가 확인란을 치고 수동 게시합니다. 자동 게시하지 않습니다.";
}

/** House-original-only action labels. Catalog keeps TRANSITION_ACTION_LABELS. */
export function houseOriginalTransitionLabel(to: string): string | null {
  if (to === "approved") return "수동 게시";
  if (to === "rights_checking") return "권리 확인으로";
  return null;
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
