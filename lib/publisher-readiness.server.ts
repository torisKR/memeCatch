import "server-only";

import type { createClient } from "@/lib/supabase/server";
import {
  PUBLISHER_READINESS_PAGE_SIZE,
  buildPublisherReadinessPage,
  parsePublisherReadinessFocus,
  parsePublisherReadinessPage,
  type PublisherReadinessFocus,
  type PublisherReadinessReport,
  type PublisherReviewChecklist,
  type PublisherReviewEvidence,
  type PublisherReadinessRow,
} from "@/lib/publisher-readiness";

export const PUBLISHER_READINESS_SELECT =
  "id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, moderation_status, published_at, updated_at, safety_level, safety_reviewed_at, house_rights_attested_at, meme_sources(source_url, source_role, rights_basis, copyright_status, captured_at), meme_contents(url, content_id, availability, moderation_status), meme_tags_map(tag_id)" as const;

const PUBLISHER_REVIEW_ACTION = "publisher.readiness.review";
const PUBLISHER_REVIEW_AUDIT_LIMIT = 1_000;

type PublisherReadinessClient = Awaited<ReturnType<typeof createClient>>;

export type PublisherReadinessPageOptions = {
  page?: number;
  focus?: PublisherReadinessFocus | null;
  now?: Date;
};

type AuditRow = {
  entity_id: string | null;
  created_at: string;
  detail: unknown;
};

function reviewEvidenceFromAudit(row: AuditRow): PublisherReviewEvidence | null {
  if (!row.entity_id || !row.detail || typeof row.detail !== "object" || Array.isArray(row.detail)) {
    return null;
  }
  const detail = row.detail as Record<string, unknown>;
  if (
    detail.version !== 1 ||
    typeof detail.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(detail.fingerprint) ||
    !detail.checklist ||
    typeof detail.checklist !== "object" ||
    Array.isArray(detail.checklist) ||
    typeof detail.note !== "string" ||
    detail.note.length > 2000
  ) return null;
  const checklist = detail.checklist as Record<string, unknown>;
  const parsedChecklist: PublisherReviewChecklist = {
    meaningContext: checklist.meaningContext === true,
    sourceClaims: checklist.sourceClaims === true,
    rightsDelivery: checklist.rightsDelivery === true,
    safetyContext: checklist.safetyContext === true,
    ownHumanValue: checklist.ownHumanValue === true,
  };
  return {
    fingerprint: detail.fingerprint,
    checklist: parsedChecklist,
    note: detail.note,
    reviewedAt: row.created_at,
  };
}

async function loadLatestPublisherReviews(
  supabase: PublisherReadinessClient,
  memeIds: readonly string[],
): Promise<ReadonlyMap<string, PublisherReviewEvidence>> {
  if (memeIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("entity_id, created_at, detail")
    .eq("entity_type", "meme")
    .eq("action", PUBLISHER_REVIEW_ACTION)
    .in("entity_id", [...memeIds])
    .order("created_at", { ascending: false })
    .limit(PUBLISHER_REVIEW_AUDIT_LIMIT)
    .returns<AuditRow[]>();
  if (error) throw new Error(`퍼블리셔 검수 기록을 불러오지 못했어요: ${error.message}`);

  const latest = new Map<string, PublisherReviewEvidence>();
  for (const row of data ?? []) {
    if (!row.entity_id || latest.has(row.entity_id)) continue;
    const evidence = reviewEvidenceFromAudit(row);
    if (evidence) latest.set(row.entity_id, evidence);
  }
  return latest;
}

export async function listPublisherReadinessPage(
  supabase: PublisherReadinessClient,
  options: PublisherReadinessPageOptions,
): Promise<PublisherReadinessReport> {
  const page = parsePublisherReadinessPage(options.page);
  const focus = parsePublisherReadinessFocus(options.focus);
  const from = (page - 1) * PUBLISHER_READINESS_PAGE_SIZE;
  const to = from + PUBLISHER_READINESS_PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("memes")
    .select(PUBLISHER_READINESS_SELECT, { count: "exact" })
    .in("moderation_status", ["approved", "limited"])
    .order("id", { ascending: true })
    .range(from, to)
    .returns<PublisherReadinessRow[]>();

  if (error) {
    throw new Error(`퍼블리셔 준비도 데이터를 불러오지 못했어요: ${error.message}`);
  }
  if (count === null) {
    throw new Error("전체 공개 문서 수를 확인하지 못했어요.");
  }
  const rows = data ?? [];
  const reviewsByMemeId = await loadLatestPublisherReviews(
    supabase,
    rows.map((row) => row.id),
  );

  return buildPublisherReadinessPage(rows, {
    page,
    totalPublic: count,
    focus,
    now: options.now,
    reviewsByMemeId,
  });
}
