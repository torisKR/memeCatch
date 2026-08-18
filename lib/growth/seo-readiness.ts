import {
  MAX_CONTENT_DEPTH_SCORE,
  contentDepth,
  isIndexableMeme,
} from "@/lib/content-depth";
import { memePathFrom } from "@/lib/labels";

export type SeoRelatedMeme = {
  id: string;
  origin_year: number | null;
  category: string;
  meme_tags_map: Array<{ tag_id?: string | null }>;
};

export type SeoAuditMeme = SeoRelatedMeme & {
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  usage_examples: unknown;
  trend_score: number;
  meme_sources: Array<{ source_url?: string | null }>;
  meme_contents: Array<{
    availability?: string | null;
    moderation_status?: string | null;
  }>;
};

export type SeoReadinessCheck =
  | "title"
  | "description"
  | "canonical"
  | "openGraph"
  | "relatedLinks"
  | "completeness";

export type SeoReadinessAudit = {
  rank: number;
  memeId: string;
  title: string;
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  relatedLinkCount: number;
  completenessScore: number;
  checks: Record<SeoReadinessCheck, boolean>;
  readinessScore: number;
  ready: boolean;
};

function generatedDescription(meme: SeoAuditMeme): string {
  return `${meme.title} 뜻과 유래 — ${meme.summary}. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.`;
}

function countRelatedCandidates(meme: SeoAuditMeme, corpus: readonly SeoRelatedMeme[]): number {
  const tags = new Set(meme.meme_tags_map.map((row) => row.tag_id).filter(Boolean));
  return corpus.filter((candidate) => {
    if (candidate.id === meme.id) return false;
    const sharesTag = candidate.meme_tags_map.some((row) => row.tag_id && tags.has(row.tag_id));
    const sameCategory = candidate.category === meme.category;
    const nearYear =
      meme.origin_year != null &&
      candidate.origin_year != null &&
      Math.abs(meme.origin_year - candidate.origin_year) <= 2;
    return sharesTag || sameCategory || nearYear;
  }).length;
}

function duplicateValues(values: readonly string[], normalize = (value: string) => value): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalize(value);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

export function auditTopSeoMemes(
  memes: readonly SeoAuditMeme[],
  options: {
    limit?: number;
    relatedCorpus?: readonly SeoRelatedMeme[];
    relatedCounts?: ReadonlyMap<string, number>;
    targetIds?: readonly string[];
  } = {},
): SeoReadinessAudit[] {
  const { limit = 100, relatedCorpus = memes, relatedCounts, targetIds } = options;
  const targetRank = targetIds
    ? new Map(targetIds.map((id, index) => [id, index]))
    : undefined;
  const ranked = [...memes]
    .filter((meme) => !targetRank || targetRank.has(meme.id))
    .sort((left, right) => {
      if (targetRank) return targetRank.get(left.id)! - targetRank.get(right.id)!;
      return right.trend_score - left.trend_score || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
  const metadataTitles = ranked.map((meme) => `${meme.title} 뜻`);
  const metadataDescriptions = ranked.map(generatedDescription);
  const paths = ranked.map((meme) => memePathFrom(meme.short_id, meme.slug));
  const normalizeText = (value: string) => value.trim().toLocaleLowerCase("ko-KR");
  const duplicateTitles = duplicateValues(metadataTitles, normalizeText);
  const duplicateDescriptions = duplicateValues(metadataDescriptions, normalizeText);
  const duplicatePaths = duplicateValues(paths);

  return ranked.map((meme, index) => {
    const metadataTitle = metadataTitles[index];
    const metadataDescription = metadataDescriptions[index];
    const path = paths[index];
    const relatedLinkCount = relatedCounts?.get(meme.id) ?? countRelatedCandidates(meme, relatedCorpus);
    const depth = contentDepth(meme);
    const completenessScore = Math.round((depth.score / MAX_CONTENT_DEPTH_SCORE) * 100);
    const checks: Record<SeoReadinessCheck, boolean> = {
      title: meme.title.trim().length >= 2 && !duplicateTitles.has(normalizeText(metadataTitle)),
      description:
        meme.summary.trim().length >= 10 && !duplicateDescriptions.has(normalizeText(metadataDescription)),
      canonical:
        meme.short_id.trim().length > 0 && meme.slug.trim().length > 0 && !duplicatePaths.has(path),
      openGraph:
        metadataTitle.length > 0 &&
        metadataDescription.length > 0 &&
        path.startsWith("/memes/") &&
        !duplicateTitles.has(normalizeText(metadataTitle)) &&
        !duplicateDescriptions.has(normalizeText(metadataDescription)) &&
        !duplicatePaths.has(path),
      relatedLinks: relatedLinkCount > 0,
      completeness: isIndexableMeme(meme),
    };
    const passed = Object.values(checks).filter(Boolean).length;

    return {
      rank: index + 1,
      memeId: meme.id,
      title: meme.title,
      path,
      metadataTitle,
      metadataDescription,
      relatedLinkCount,
      completenessScore,
      checks,
      readinessScore: Math.round((passed / Object.keys(checks).length) * 100),
      ready: passed === Object.keys(checks).length,
    };
  });
}

export function summarizeSeoReadiness(rows: readonly SeoReadinessAudit[], expected = 100) {
  const ready = rows.filter((row) => row.ready).length;
  return {
    expected,
    audited: rows.length,
    coverageGap: Math.max(0, expected - rows.length),
    ready,
    blocked: rows.length - ready,
    completionPercentage: rows.length === 0 ? 0 : Math.round((ready / rows.length) * 100),
  };
}
