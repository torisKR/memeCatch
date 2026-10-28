import { createHash } from "node:crypto";

import {
  CONTENT_DEPTH_THRESHOLDS,
  contentDepth,
  type ContentDepth,
  type ContentDepthInput,
} from "./content-depth.ts";
import { UNAVAILABLE_STATUSES } from "./content-availability.ts";
import { memePathFrom } from "./labels.ts";
import { evidenceTimestamp, publicSourceUrl } from "./source-links.ts";
import { RIGHTS_BASIS } from "./sources/review.ts";

export const PUBLISHER_READINESS_PAGE_SIZE = 100;
export const PUBLISHER_READINESS_MAX_PAGE = 10_000;
export const PUBLISHER_SOURCE_STALE_AFTER_DAYS = 180;

export const PUBLISHER_REVIEW_CHECKLIST_KEYS = [
  "meaningContext",
  "sourceClaims",
  "rightsDelivery",
  "safetyContext",
  "ownHumanValue",
] as const;
export type PublisherReviewChecklistKey = (typeof PUBLISHER_REVIEW_CHECKLIST_KEYS)[number];
export type PublisherReviewChecklist = Record<PublisherReviewChecklistKey, boolean>;

export const PUBLISHER_READINESS_FOCUSES = [
  "source",
  "rights",
  "summary",
  "date",
  "depth",
  "media",
  "safety",
  "stale",
  "template",
  "copy",
  "review",
] as const;
export type PublisherReadinessFocus = (typeof PUBLISHER_READINESS_FOCUSES)[number];
export type PublisherReadinessIssueCode = PublisherReadinessFocus;

export type PublisherReadinessRow = Omit<ContentDepthInput, "meme_sources" | "meme_contents"> & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  moderation_status: string;
  published_at: string | null;
  updated_at: string;
  safety_level: string;
  safety_reviewed_at: string | null;
  house_rights_attested_at: string | null;
  meme_sources?: Array<{
    source_url?: string | null;
    source_role?: string | null;
    rights_basis?: string | null;
    copyright_status?: string | null;
    captured_at?: string | null;
  }> | null;
  meme_contents?: Array<{
    url?: string | null;
    content_id?: string | null;
    availability?: string | null;
    moderation_status?: string | null;
  }> | null;
};

export type PublisherReviewEvidence = {
  fingerprint: string;
  checklist: PublisherReviewChecklist;
  note: string;
  reviewedAt: string;
};

export type PublisherReadinessIssue = {
  code: PublisherReadinessIssueCode;
  label: string;
  explanation: string;
  action: string;
};

export type PublisherReadinessItem = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  moderationStatus: string;
  publishedAt: string | null;
  editHref: string;
  publicHref: string;
  sourceWorkflowHref: string;
  safeSourceUrls: string[];
  fingerprint: string;
  rights: {
    status: "confirmed_delivery" | "restricted" | "unknown" | "absent";
    confirmedCount: number;
    unknownCount: number;
    restrictedCount: number;
  };
  media: {
    status: "renderable" | "partial" | "unchecked" | "unavailable" | "absent";
    renderableCount: number;
    uncheckedCount: number;
    unavailableCount: number;
  };
  safety: {
    status: "current" | "stale" | "unknown";
    reviewedAt: string | null;
  };
  sourceFreshness: {
    status: "current" | "stale" | "unknown" | "absent";
    staleCount: number;
    unavailableCount: number;
  };
  review: {
    status: "current" | "stale" | "unreviewed";
    reviewedAt: string | null;
    note: string | null;
  };
  depth: ContentDepth;
  issueCodes: PublisherReadinessIssueCode[];
  issues: PublisherReadinessIssue[];
};

export type PublisherReadinessReport = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalPublic: number;
  inspectedCount: number;
  displayedCount: number;
  focus: PublisherReadinessFocus | null;
  items: PublisherReadinessItem[];
};

export function parsePublisherReadinessPage(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, PUBLISHER_READINESS_MAX_PAGE);
}

export function parsePublisherReadinessFocus(value: unknown): PublisherReadinessFocus | null {
  return typeof value === "string" &&
    (PUBLISHER_READINESS_FOCUSES as readonly string[]).includes(value)
    ? (value as PublisherReadinessFocus)
    : null;
}

function safeSourceUrls(sources: PublisherReadinessRow["meme_sources"]): string[] {
  if (!Array.isArray(sources)) return [];
  const seen = new Set<string>();
  const safe: string[] = [];

  for (const source of sources) {
    const normalized = publicSourceUrl(source?.source_url);
    if (!normalized) continue;
    const documentUrl = new URL(normalized);
    documentUrl.hash = "";
    const key = documentUrl.href;
    if (seen.has(key)) continue;
    seen.add(key);
    safe.push(normalized);
  }

  return safe;
}

function sourceScore(count: number): number {
  return count >= 2 ? 2 : count === 1 ? 1 : 0;
}

function contentDepthWithValidatedSources(
  row: PublisherReadinessRow,
  validatedSources: readonly string[],
): ContentDepth {
  const depth = contentDepth({
    ...row,
    meme_sources: validatedSources.map((source_url) => ({ source_url })),
  });
  const score =
    depth.score - sourceScore(depth.signals.sourceCount) + sourceScore(validatedSources.length);
  const isSubstantial =
    depth.proseChars >= CONTENT_DEPTH_THRESHOLDS.MIN_PROSE_CHARS &&
    score >= CONTENT_DEPTH_THRESHOLDS.MIN_SCORE;

  return {
    ...depth,
    score,
    isSubstantial,
    isThin: !isSubstantial,
    signals: { ...depth.signals, sourceCount: validatedSources.length },
  };
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function normalizedSourceForFingerprint(
  source: NonNullable<PublisherReadinessRow["meme_sources"]>[number],
) {
  const url = publicSourceUrl(source?.source_url);
  return {
    url: url ? new URL(url).href : null,
    sourceRole: normalizedText(source?.source_role ?? ""),
    rightsBasis: normalizedText(source?.rights_basis ?? ""),
    copyrightStatus: normalizedText(source?.copyright_status ?? ""),
    capturedAt: source?.captured_at ?? null,
  };
}

function normalizedInstantOrRaw(value: string | null): string | null {
  if (value === null) return null;
  const valid = evidenceTimestamp(value, Number.POSITIVE_INFINITY);
  return valid ? new Date(Date.parse(valid)).toISOString() : value;
}

export function publisherReadinessFingerprint(row: PublisherReadinessRow): string {
  const sources = (row.meme_sources ?? [])
    .map(normalizedSourceForFingerprint)
    .sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
  const contents = (row.meme_contents ?? [])
    .map((content) => ({
      url: content?.url?.trim() || null,
      contentId: content?.content_id?.trim() || null,
      availability: content?.availability ?? null,
      moderationStatus: content?.moderation_status ?? null,
    }))
    .sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
  const payload = {
    title: normalizedText(row.title),
    summary: normalizedText(row.summary),
    description: normalizedText(row.description ?? ""),
    origin: normalizedText(row.origin ?? ""),
    usageNote: normalizedText(row.usage_note ?? ""),
    caution: normalizedText(row.caution ?? ""),
    usageExamples: row.usage_examples ?? null,
    publishedAt: normalizedInstantOrRaw(row.published_at),
    safetyLevel: row.safety_level,
    safetyReviewedAt: row.safety_reviewed_at,
    houseRightsAttestedAt: row.house_rights_attested_at,
    sources,
    contents,
  };
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

function allChecklistItemsConfirmed(checklist: PublisherReviewChecklist): boolean {
  return PUBLISHER_REVIEW_CHECKLIST_KEYS.every((key) => checklist[key] === true);
}

function rightsAssessment(row: PublisherReadinessRow, safeUrlSet: ReadonlySet<string>) {
  const sources = (row.meme_sources ?? []).filter((source) => {
    const url = publicSourceUrl(source?.source_url);
    return url ? safeUrlSet.has(url) : false;
  });
  if (sources.length === 0) {
    return { status: "absent" as const, confirmedCount: 0, unknownCount: 0, restrictedCount: 0 };
  }

  let confirmedCount = 0;
  let unknownCount = 0;
  let restrictedCount = 0;
  const confirmedDeliveryBases = new Set<string>(
    RIGHTS_BASIS.filter((basis) => basis !== "unknown" && basis !== "blocked"),
  );
  for (const source of sources) {
    const copyright = source.copyright_status?.trim() ?? "";
    const basis = source.rights_basis?.trim() ?? "";
    if (copyright === "permission_needed" || copyright === "internal_only" || basis === "blocked") {
      restrictedCount += 1;
    } else if (confirmedDeliveryBases.has(basis) || copyright === "embeddable") {
      confirmedCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return {
    status: restrictedCount > 0
      ? "restricted" as const
      : unknownCount > 0
        ? "unknown" as const
        : "confirmed_delivery" as const,
    confirmedCount,
    unknownCount,
    restrictedCount,
  };
}

function mediaAssessment(row: PublisherReadinessRow) {
  const contents = row.meme_contents ?? [];
  if (contents.length === 0) {
    return { status: "absent" as const, renderableCount: 0, uncheckedCount: 0, unavailableCount: 0 };
  }
  let renderableCount = 0;
  let uncheckedCount = 0;
  let unavailableCount = 0;
  for (const content of contents) {
    if (UNAVAILABLE_STATUSES.includes(content.availability as (typeof UNAVAILABLE_STATUSES)[number])) {
      unavailableCount += 1;
    } else if (content.availability === "live" && content.moderation_status === "approved") {
      renderableCount += 1;
    } else {
      uncheckedCount += 1;
    }
  }
  return {
    status: renderableCount > 0 && (uncheckedCount > 0 || unavailableCount > 0)
      ? "partial" as const
      : renderableCount > 0
      ? "renderable" as const
      : unavailableCount > 0 && uncheckedCount === 0
        ? "unavailable" as const
        : "unchecked" as const,
    renderableCount,
    uncheckedCount,
    unavailableCount,
  };
}

function safetyAssessment(row: PublisherReadinessRow) {
  const reviewed = evidenceTimestamp(row.safety_reviewed_at);
  if (!reviewed) return { status: "unknown" as const, reviewedAt: null };
  const updated = evidenceTimestamp(row.updated_at);
  return {
    status: updated && Date.parse(reviewed) < Date.parse(updated) ? "stale" as const : "current" as const,
    reviewedAt: new Date(Date.parse(reviewed)).toISOString(),
  };
}

function sourceFreshnessAssessment(row: PublisherReadinessRow, now: Date) {
  const sources = row.meme_sources ?? [];
  const unavailableCount = (row.meme_contents ?? []).filter((content) =>
    UNAVAILABLE_STATUSES.includes(content.availability as (typeof UNAVAILABLE_STATUSES)[number])
  ).length;
  if (sources.length === 0) {
    return { status: "absent" as const, staleCount: 0, unavailableCount };
  }
  const staleBefore = now.getTime() - PUBLISHER_SOURCE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  let staleCount = 0;
  let unknownCount = 0;
  for (const source of sources) {
    const captured = evidenceTimestamp(source.captured_at, now.getTime());
    if (!captured) unknownCount += 1;
    else if (Date.parse(captured) < staleBefore) staleCount += 1;
  }
  return {
    status: staleCount > 0
      ? "stale" as const
      : unknownCount > 0
        ? "unknown" as const
        : "current" as const,
    staleCount,
    unavailableCount,
  };
}

function titleLooksTemplated(title: string): boolean {
  const value = normalizedText(title);
  return /(?:\||[-–—])\s*밈캐치$/.test(value) || /(?:밈\s*)?(?:뜻과\s*유래|뜻·유래|뜻\/유래|사용법)$/.test(value);
}

function hasCopiedCoreProse(row: PublisherReadinessRow): boolean {
  const values = [row.summary, row.description, row.origin, row.usage_note, row.caution]
    .map((value) => normalizedText(value ?? ""))
    .filter((value) => value.length >= 80);
  return new Set(values).size !== values.length;
}

function publicationDateIssue(value: string | null, now: Date): PublisherReadinessIssue | null {
  if (!value?.trim()) {
    return {
      code: "date",
      label: "게시일 없음",
      explanation: "게시일이 비어 있어 실제 공개 시점을 확인할 수 없습니다.",
      action: "밈캐치의 최초 공개 시점을 운영 기록에서 확인하고 정정 근거를 남겨 주세요. 원본 영상이나 기사 발행일과는 구분해야 합니다. 별도 운영 데이터 정정이 필요한 published_at 필드로, 현재 밈 편집 화면에서는 수정할 수 없습니다.",
    };
  }

  if (evidenceTimestamp(value, now.getTime())) return null;

  return {
    code: "date",
    label: "게시일 확인 필요",
    explanation: "게시일이 유효하지 않거나 미래 시각이어서 실제 공개 시점으로 사용할 수 없습니다.",
    action: "밈캐치의 최초 공개 시점을 운영 기록에서 확인하고 정정 근거를 남겨 주세요. 원본 영상이나 기사 발행일과는 구분해야 합니다. 별도 운영 데이터 정정이 필요한 published_at 필드로, 현재 밈 편집 화면에서는 수정할 수 없습니다.",
  };
}

export function classifyPublisherReadiness(
  row: PublisherReadinessRow,
  now: Date = new Date(),
  reviewEvidence?: PublisherReviewEvidence | null,
): PublisherReadinessItem {
  const validatedSources = safeSourceUrls(row.meme_sources);
  const depth = contentDepthWithValidatedSources(row, validatedSources);
  const issues: PublisherReadinessIssue[] = [];
  const fingerprint = publisherReadinessFingerprint(row);
  const safeUrlSet = new Set(validatedSources);
  const rights = rightsAssessment(row, safeUrlSet);
  const media = mediaAssessment(row);
  const safety = safetyAssessment(row);
  const sourceFreshness = sourceFreshnessAssessment(row, now);

  if (validatedSources.length === 0) {
    issues.push({
      code: "source",
      label: "공개 출처 없음",
      explanation: "검증 가능한 공개 HTTP(S) 출처가 없습니다. 비공개·내부·인증 포함 주소는 세지 않습니다.",
      action: "밈 편집 또는 출처 검수에서 실제 공개 출처와 맥락을 확인하세요.",
    });
  }

  if (rights.status === "unknown" || rights.status === "absent") {
    issues.push({
      code: "rights",
      label: "권리/전달 근거 미확인",
      explanation: "링크·공식 임베드·자체 제작·허가 등 화면에 전달하는 방식의 근거가 확인되지 않았습니다. 출처 링크가 있다는 사실만으로 소유권이나 재사용 권리가 생기지는 않습니다.",
      action: "출처별 source_role, rights_basis, copyright_status를 실제 이용 방식에 맞게 검수하세요.",
    });
  } else if (rights.status === "restricted") {
    issues.push({
      code: "rights",
      label: "권리 제한 확인 필요",
      explanation: "허가 필요 또는 내부 전용으로 표시된 출처가 있습니다. 이는 공개·광고 적합성을 자동 판정하지 않는 보류 신호입니다.",
      action: "제한된 원자료를 공개 화면이 직접 재사용하지 않는지 확인하고 필요한 허가 또는 링크 전용 처리를 기록하세요.",
    });
  }

  const summary = normalizedText(row.summary);
  if (!summary) {
    issues.push({
      code: "summary",
      label: "요약 없음",
      explanation: "요약이 비어 있어 독자가 제목만으로 의미와 맥락을 판단해야 합니다.",
      action: "밈 편집에서 뜻과 사용 맥락을 담은 고유 요약을 작성하세요.",
    });
  } else if (normalizedText(row.title) === summary) {
    issues.push({
      code: "summary",
      label: "제목 반복 요약",
      explanation: "요약이 제목과 같아 독자에게 추가 설명을 제공하지 않습니다.",
      action: "밈 편집에서 뜻과 사용 맥락을 담은 고유 요약으로 보완하세요.",
    });
  }

  const dateIssue = publicationDateIssue(row.published_at, now);
  if (dateIssue) issues.push(dateIssue);

  if (!depth.isSubstantial) {
    issues.push({
      code: "depth",
      label: "고유 설명 부족",
      explanation: `현재 고유 산문 ${depth.proseChars}자, 콘텐츠 깊이 ${depth.score}점입니다. 내부 운영 기준은 산문 ${CONTENT_DEPTH_THRESHOLDS.MIN_PROSE_CHARS}자 이상과 ${CONTENT_DEPTH_THRESHOLDS.MIN_SCORE}점 이상을 모두 요구합니다.`,
      action: "밈 편집에서 출처를 베끼지 말고 의미·유래·사용법·주의·예문을 근거에 맞게 보완하세요.",
    });
  }

  if (media.status === "unavailable" || media.status === "unchecked" || media.status === "partial") {
    issues.push({
      code: "media",
      label: media.status === "unavailable"
        ? "공개 미디어 재생 불가"
        : media.status === "partial"
          ? "일부 공개 미디어 확인 필요"
          : "공개 미디어 검수 미완료",
      explanation: media.status === "unavailable"
        ? "삭제 또는 지역 제한 상태의 미디어만 연결되어 있습니다."
        : media.status === "partial"
          ? "live+approved로 확인된 미디어와 미확인·미검수·삭제된 미디어가 함께 연결되어 있습니다."
          : "live+approved 조건을 모두 충족한 미디어가 없습니다.",
      action: "공식 링크·임베드의 현재 공개 상태를 확인하세요. 미디어가 없는 텍스트 문서는 별도 오류로 보지 않습니다.",
    });
  }

  if (safety.status !== "current") {
    issues.push({
      code: "safety",
      label: safety.status === "stale" ? "안전 검수 갱신 필요" : "안전 검수 미확인",
      explanation: safety.status === "stale"
        ? "콘텐츠가 안전 검수 뒤 변경되어 현재 문맥에 맞는지 다시 확인해야 합니다."
        : "안전 수준과 주의 맥락을 사람이 확인한 시각이 없습니다.",
      action: "현재 설명·사용 예·주의 문구를 기준으로 안전 검수를 다시 수행하세요.",
    });
  }

  if (sourceFreshness.status === "stale" || sourceFreshness.status === "unknown" || sourceFreshness.unavailableCount > 0) {
    issues.push({
      code: "stale",
      label: sourceFreshness.unavailableCount > 0 ? "삭제·제한 출처 재확인" : "출처 확인 기록 오래됨",
      explanation: sourceFreshness.unavailableCount > 0
        ? "삭제·지역 제한된 미디어 기록이 있어 현재 독자에게 제공되는 근거를 재확인해야 합니다."
        : `출처 수집 시각이 없거나 ${PUBLISHER_SOURCE_STALE_AFTER_DAYS}일보다 오래됐습니다. 오래된 기록만으로 실제 삭제를 단정하지 않습니다.`,
      action: "원자료의 현재 접근 가능성과 화면에 남길 링크·설명을 확인하세요.",
    });
  }

  if (titleLooksTemplated(row.title)) {
    issues.push({
      code: "template",
      label: "템플릿형 제목 확인",
      explanation: "검색 문구나 사이트 이름을 반복한 제목 형태입니다. 밈의 실제 이름보다 SEO 문구가 앞서지 않는지 확인해야 합니다.",
      action: "실제 밈 이름을 제목으로 두고 뜻·유래·사용법은 본문 구조로 제공하세요.",
    });
  }

  if (hasCopiedCoreProse(row)) {
    issues.push({
      code: "copy",
      label: "내부 문단 중복 확인",
      explanation: "요약·설명·유래·사용법·주의 중 긴 문단이 동일하거나 중복됩니다. 표절 여부를 판정하지 않고 자체 해설의 실질 가치를 사람이 확인하도록 하는 신호입니다.",
      action: "각 문단의 역할을 분리하고 출처 문구를 그대로 반복하지 않았는지 확인하세요.",
    });
  }

  const review = reviewEvidence && allChecklistItemsConfirmed(reviewEvidence.checklist)
    ? {
        status: reviewEvidence.fingerprint === fingerprint ? "current" as const : "stale" as const,
        reviewedAt: reviewEvidence.reviewedAt,
        note: reviewEvidence.note,
      }
    : { status: "unreviewed" as const, reviewedAt: null, note: null };
  if (review.status !== "current") {
    issues.push({
      code: "review",
      label: review.status === "stale" ? "사람 검수 만료" : "사람 검수 미완료",
      explanation: review.status === "stale"
        ? "핵심 본문·출처·권리·안전 정보가 마지막 체크리스트 검수 뒤 바뀌었습니다."
        : "승인 상태나 글자 수만으로 독창성·정확성·권리·안전 확인을 대신할 수 없습니다.",
      action: "현재 문서를 직접 확인한 뒤 광고 심사 준비 체크리스트를 기록하세요.",
    });
  }

  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    title: row.title,
    moderationStatus: row.moderation_status,
    publishedAt: row.published_at,
    editHref: `/admin/memes/${encodeURIComponent(row.id)}`,
    publicHref: memePathFrom(row.short_id, row.slug),
    sourceWorkflowHref: "/admin/sources",
    safeSourceUrls: validatedSources,
    fingerprint,
    rights,
    media,
    safety,
    sourceFreshness,
    review,
    depth,
    issueCodes: issues.map((issue) => issue.code),
    issues,
  };
}

export function buildPublisherReadinessPage(
  rows: readonly PublisherReadinessRow[],
  options: {
    page: number;
    totalPublic: number;
    focus: PublisherReadinessFocus | null;
    now?: Date;
    reviewsByMemeId?: ReadonlyMap<string, PublisherReviewEvidence>;
  },
): PublisherReadinessReport {
  const inspected = rows.map((row) =>
    classifyPublisherReadiness(row, options.now, options.reviewsByMemeId?.get(row.id)),
  );
  const duplicates = new Map<string, number>();
  for (const row of rows) {
    for (const value of [row.summary, row.description]) {
      const normalized = normalizedText(value ?? "");
      if (normalized.length < 80) continue;
      duplicates.set(normalized, (duplicates.get(normalized) ?? 0) + 1);
    }
  }
  const withPageDuplicates = inspected.map((item, index) => {
    const row = rows[index];
    const hasPageDuplicate = [row.summary, row.description].some((value) => {
      const normalized = normalizedText(value ?? "");
      return normalized.length >= 80 && (duplicates.get(normalized) ?? 0) > 1;
    });
    if (!hasPageDuplicate || item.issueCodes.includes("copy")) return item;
    const issue: PublisherReadinessIssue = {
      code: "copy",
      label: "현재 페이지 문서 간 중복 확인",
      explanation: "현재 100개 검사 묶음 안에서 다른 문서와 동일한 긴 요약 또는 설명이 발견됐습니다. 전체 코퍼스 중복이나 표절을 확정하는 결과는 아닙니다.",
      action: "두 문서의 의미와 사용 맥락이 실제로 다른지 비교하고 고유 설명으로 정리하세요.",
    };
    return {
      ...item,
      issueCodes: [...item.issueCodes, "copy" as const],
      issues: [...item.issues, issue],
    };
  });
  const items = options.focus
    ? withPageDuplicates.filter((item) => item.issueCodes.includes(options.focus!))
    : withPageDuplicates;

  return {
    page: options.page,
    pageSize: PUBLISHER_READINESS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(options.totalPublic / PUBLISHER_READINESS_PAGE_SIZE)),
    totalPublic: options.totalPublic,
    inspectedCount: inspected.length,
    displayedCount: items.length,
    focus: options.focus,
    items,
  };
}
