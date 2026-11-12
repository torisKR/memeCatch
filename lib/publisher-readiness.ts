import {
  CONTENT_DEPTH_THRESHOLDS,
  contentDepth,
  type ContentDepth,
  type ContentDepthInput,
} from "@/lib/content-depth";
import { memePathFrom } from "@/lib/labels";
import { evidenceTimestamp, isPublicDisplaySource, publicSourceUrl } from "@/lib/source-links";

export const PUBLISHER_READINESS_PAGE_SIZE = 100;
export const PUBLISHER_READINESS_MAX_PAGE = 10_000;

export const PUBLISHER_READINESS_FOCUSES = ["source", "summary", "date", "depth"] as const;
export type PublisherReadinessFocus = (typeof PUBLISHER_READINESS_FOCUSES)[number];
export type PublisherReadinessIssueCode = PublisherReadinessFocus;

export type PublisherReadinessRow = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  moderation_status: string;
  published_at: string | null;
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
    if (!source || !isPublicDisplaySource(source)) continue;
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
): PublisherReadinessItem {
  const validatedSources = safeSourceUrls(row.meme_sources);
  const depth = contentDepthWithValidatedSources(row, validatedSources);
  const issues: PublisherReadinessIssue[] = [];

  if (validatedSources.length === 0) {
    issues.push({
      code: "source",
      label: "공개 출처 없음",
      explanation: "검증 가능한 공개 HTTP(S) 출처가 없습니다. 비공개·내부·인증 포함 주소는 세지 않습니다.",
      action: "밈 편집 또는 출처 검수에서 실제 공개 출처와 맥락을 확인하세요.",
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
  },
): PublisherReadinessReport {
  const inspected = rows.map((row) => classifyPublisherReadiness(row, options.now));
  const items = options.focus
    ? inspected.filter((item) => item.issueCodes.includes(options.focus!))
    : inspected;

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
