import { CATEGORIES, type MemeCategory } from "@/lib/labels";

/** 같은 카테고리와 ±2년 인접 밈을 한 번의 목록 조회로 모은다. */
export function relatedMemePoolFilter(category: MemeCategory, originYear: number | null): string {
  if (!Object.hasOwn(CATEGORIES, category)) {
    throw new Error("unknown meme category");
  }
  if (originYear == null || !Number.isFinite(originYear)) {
    return `category.eq.${category}`;
  }
  const year = Math.trunc(originYear);
  return `category.eq.${category},and(origin_year.gte.${year - 2},origin_year.lte.${year + 2})`;
}
