import { SAFETY_LEVELS, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import type { Json } from "@/lib/database.types";
import { SafetyIcon } from "@/components/safety-icon";

export { SafetySignalGuide } from "@/components/safety-legend";

const TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/** 아이콘 앞 장식용 모노 상태코드 — aria-hidden, 판정 텍스트(TONE·s.user)는 불변 */
const STATUS_CODE: Record<SafetyLevel, string> = {
  green: "OK",
  yellow: "CTN",
  gray: "OLD",
  red: "NG",
};

function isSafetyLevel(v: unknown): v is SafetyLevel {
  return typeof v === "string" && v in SAFETY_LEVELS;
}

export type UsageContextRow = {
  key: keyof typeof USAGE_CONTEXTS;
  level: SafetyLevel;
};

export type CommercialUsageContextRow = {
  key: UsageContextRow["key"];
  label: string;
  level: SafetyLevel;
  reason: string;
};

const CONTEXT_REASON_FALLBACK: Record<UsageContextRow["key"], string> = {
  work: "직장에서의 사용 맥락을 기준으로 한 판정이에요.",
  friends: "친구끼리의 사용 맥락을 기준으로 한 판정이에요.",
  family: "자녀·가족과의 사용 맥락을 기준으로 한 판정이에요.",
  sns: "공개 SNS에서의 사용 맥락을 기준으로 한 판정이에요.",
};

/** usage_context jsonb({"work":"green",...}) → 검증된 상황별 행 목록 */
export function parseUsageContext(context: Json): UsageContextRow[] {
  const raw =
    context && typeof context === "object" && !Array.isArray(context)
      ? (context as Record<string, unknown>)
      : {};
  return (Object.keys(USAGE_CONTEXTS) as (keyof typeof USAGE_CONTEXTS)[])
    .map((key) => ({ key, level: raw[key] }))
    .filter((r): r is UsageContextRow => isSafetyLevel(r.level));
}

/**
 * 「상황별 판정 미확인」 — 4칸이 전부 green이면 상황별로 나눠 확인한 흔적이 없다
 * (같은 값이 캐릭터/생성 단계 기본값으로 남은 것으로 추정, HG-003 C안).
 *
 * 의도적으로 「전부 green」만 본다 — 「전부 동일값」 전체가 아니다. 4칸이 동일하게
 * red/yellow/gray인 문서는 「어디서도 쓰지 마세요」라는 정당한 판정일 수 있고,
 * 이미 확인된 경고를 미확인으로 낮추는 쪽이 근거 없는 green 표시보다 위험하다
 * (비대칭 위험: 관대한 오판은 사용자가 손해를 보지만, 엄격한 반복은 비용이 없다).
 */
export function isUnverifiedUsageContext(rows: UsageContextRow[]): boolean {
  return rows.length >= 2 && rows.every((r) => r.level === "green");
}

export function buildCommercialUsageContexts(
  rows: UsageContextRow[],
  note?: string | null,
  caution?: string | null,
): CommercialUsageContextRow[] {
  const noteText = note?.trim() || null;
  const cautionText = caution?.trim() || null;

  return rows.map(({ key, level }) => ({
    key,
    label: USAGE_CONTEXTS[key],
    level,
    reason: level === "green"
      ? noteText ?? CONTEXT_REASON_FALLBACK[key]
      : cautionText ?? noteText ?? CONTEXT_REASON_FALLBACK[key],
  }));
}

function reviewDate(value?: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

/** 상황별 가·불가 행 목록 — UsageGuide와 SafetyRationale이 공유(중복 마크업 금지) */
export function UsageContextRows({ rows }: { rows: CommercialUsageContextRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map(({ key, label, level, reason }) => {
        return (
          <li
            key={key}
            className="hover-glow-flame flex min-h-11 items-center justify-between gap-3 rounded-lg py-2"
          >
            <span>
              <span className="text-base font-medium">{label}</span>
              <span className="mt-0.5 block text-sm text-muted">{reason}</span>
            </span>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${TONE[level]}`}>
              <span aria-hidden className="stat-mono text-[10px] font-bold tracking-wider">{STATUS_CODE[level]}</span>
              <span aria-hidden className="leading-none">
                <SafetyIcon level={level} className="size-4" />
              </span>
              {SAFETY_LEVELS[level].user}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 상황별 사용 가이드 — usage_context jsonb({"work":"green",...}) × 신호등.
 * 유효한 항목이 하나도 없으면 렌더하지 않는다.
 * 밈 상세에서는 SafetyRationale(판정 근거 카드)이 이 행 목록을 흡수해 사용한다.
 */
export function UsageGuide({
  context,
  note,
  caution,
  reviewedAt,
}: {
  context: Json;
  note?: string | null;
  caution?: string | null;
  reviewedAt?: string | null;
}) {
  const rows = buildCommercialUsageContexts(parseUsageContext(context), note, caution);
  const reviewedOn = reviewDate(reviewedAt);
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="usage-guide-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="usage-guide-title" className="text-lg font-bold">
        어디서 써도 될까요?
      </h2>
      <UsageContextRows rows={rows} />
      <p className="mt-3 text-sm text-muted">
        최근 검수일:{" "}
        {reviewedOn ? (
          <time dateTime={reviewedAt ?? undefined}>{reviewedOn}</time>
        ) : (
          "확인된 기록 없음"
        )}
      </p>
    </section>
  );
}

export { reviewDate };
