/** 홈 검증 가이드가 가리키는 편집 밈. 프록시가 이 키를 없는 문서로 지우지 않는다. */
export const CURATED_CORE_SHORT_IDS = [
  "jkm2022k",
  "fmc2022k",
  "oyj2021k",
  "nmd2022k",
  "mng2022k",
  "bjk2021k",
  "gnact78h",
  "okk2020k",
] as const;

const CURATED_CORE_SHORT_ID_SET: ReadonlySet<string> = new Set(CURATED_CORE_SHORT_IDS);

export function isCuratedCoreShortId(shortId: string): boolean {
  return CURATED_CORE_SHORT_ID_SET.has(shortId);
}
