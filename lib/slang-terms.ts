import { passesContentIndexGate, type ContentDepthInput } from "@/lib/content-depth";
import type { SafetyLevel } from "@/lib/labels";

/** /slang dictionary row shown in the list. */
export type SlangTermRow = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  safety_level: SafetyLevel;
  origin_year: number | null;
  trend_score: number;
};

export type SlangDepthRow = SlangTermRow & ContentDepthInput;

/** Enough candidates that the indexable filter can still fill a panel. */
export const SLANG_CANDIDATE_LIMIT = 240;

export const SLANG_DEPTH_SELECT =
  "id, short_id, slug, title, summary, safety_level, origin_year, trend_score, description, origin, usage_note, caution, usage_examples, meme_sources(source_url), meme_tags_map(tag_id), meme_contents(availability, moderation_status)";

/** Keep only rows whose detail page is indexable, then cap the panel. */
export function indexableSlangTerms(rows: readonly SlangDepthRow[], limit: number): SlangTermRow[] {
  return rows.filter((row) => passesContentIndexGate(row)).slice(0, limit).map((row) => ({
    id: row.id,
    short_id: row.short_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    safety_level: row.safety_level,
    origin_year: row.origin_year,
    trend_score: row.trend_score,
  }));
}
