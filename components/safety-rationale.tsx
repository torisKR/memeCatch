import { SENTIMENT, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import type { Database, Json } from "@/lib/database.types";
import { SafetyBadge } from "@/components/safety-badge";
import {
  UsageContextRows,
  isUnverifiedUsageContext,
  parseUsageContext,
  type UsageContextRow,
} from "@/components/usage-guide";

type Sentiment = Database["public"]["Enums"]["meme_sentiment"];

/**
 * 등급별 판정 기준 한 줄 — 밈 개별 사실이 아니라 신호등 산정 규칙 설명.
 * 개별 근거는 usage_note·caution 필드만 사용(별도 '근거' 데이터 발명 금지).
 *
 * 이 문장은 전 사이트 공통 범례라 **그 자체로는 이 카드를 정당화하지 못한다**.
 * 밈 고유 신호(usage_context·usage_note·caution)가 하나도 없으면 카드를 렌더하지
 * 않는다 — 모든 문서에 같은 문장만 남는 빈 템플릿이 되기 때문이다.
 */
const LEVEL_MEANING: Record<SafetyLevel, string> = {
  green:
    "커뮤니티 사용례에서 부정적 맥락 없이 널리 쓰이는 것으로 확인된 등급이에요.",
  yellow:
    "맥락에 따라 오해나 불쾌감을 줄 수 있어 상황을 가려 써야 하는 등급이에요.",
  gray: "유행이 지나 지금 쓰면 어색하게 들릴 수 있는 등급이에요.",
  red: "비하·혐오 등 부정적 맥락과 결합해 사용 자체를 권하지 않는 등급이에요.",
};

/** 등급별 서술어 — 상황 이름과 결합해 밈별 판정 문장을 만든다. */
const LEVEL_CLAUSE: Record<SafetyLevel, string> = {
  green: "무리 없이 통하지만",
  yellow: "맥락을 가려야 하고",
  gray: "지금은 한 박자 늦게 들리고",
  red: "쓰지 않는 게 좋고",
};

/** 문장 마지막 절은 종결형으로 — "…해요."로 끝맺는다. */
const LEVEL_CLAUSE_FINAL: Record<SafetyLevel, string> = {
  green: "무리 없이 통해요",
  yellow: "맥락을 가려야 해요",
  gray: "지금은 한 박자 늦게 들려요",
  red: "쓰지 않는 게 좋아요",
};

const CAUTION_TONE: Record<"red" | "yellow", string> = {
  red: "bg-safety-red-bg text-safety-red",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
};

/**
 * usage_context(밈마다 다른 실제 데이터)로 이 밈 전용 판정 문장을 조립한다.
 * 예) {friends:"green", work:"yellow", sns:"red"}
 *  → "친구끼리는 무리 없이 통하지만, 직장에서는 맥락을 가려야 하고,
 *     공개 SNS에서는 쓰지 않는 게 좋아요."
 *
 * 같은 등급끼리 묶어 상황 이름을 나열할 뿐 없는 사실을 덧붙이지 않는다.
 * 상황이 하나도 없으면 null — 호출부가 공통 범례로 물러난다.
 */
function contextVerdict(rows: UsageContextRow[]): string | null {
  if (rows.length === 0) return null;

  // 등급별로 상황을 모은다. 순서는 위험도 낮은 → 높은 순으로 읽히게 고정.
  const order: SafetyLevel[] = ["green", "yellow", "gray", "red"];
  const grouped = order
    .map((level) => ({
      level,
      names: rows.filter((r) => r.level === level).map((r) => USAGE_CONTEXTS[r.key]),
    }))
    .filter((g) => g.names.length > 0);

  if (grouped.length === 0) return null;

  return (
    grouped
      .map((g, i) => {
        const isLast = i === grouped.length - 1;
        const clause = isLast ? LEVEL_CLAUSE_FINAL[g.level] : LEVEL_CLAUSE[g.level];
        return `${g.names.join("·")}는 ${clause}`;
      })
      .join(", ") + "."
  );
}

/**
 * "이 판정의 근거" — 상세에 흩어져 있던 신호등·usage_note·caution·sentiment를
 * 판정 근거 서사 한 카드로 구조화(CTO 피드백: '안 되는 것'과 그 근거).
 * (a) 등급 + 판정 문장 — usage_context로 조립한 밈별 문장, 없으면 등급 공통 범례
 *     → 근거 문장(usage_note)
 * (b) 상황별 가·불가(usage_context — UsageGuide의 행 목록 재사용)
 * (c) sentiment(논쟁 중) 보조 칩
 * (d) caution — 실제 사유가 있을 때만. 없다고 일반 문구로 채우지 않는다.
 *
 * 고유 신호(usage_context·usage_note·caution)가 전무하면 null을 반환한다.
 */
export function SafetyRationale({
  level,
  sentiment,
  context,
  note,
  caution,
}: {
  level: SafetyLevel;
  sentiment: Sentiment;
  context: Json;
  note?: string | null;
  caution?: string | null;
}) {
  const parsedRows = parseUsageContext(context);
  // 상황별 확인 흔적이 없으면(4칸 전부 green) 상황별 행·문장을 만들지 않는다.
  // 그대로 두면 생성 단계 기본값이 "직장에서·친구끼리·...는 무리 없이 통해요"라는
  // 근거 없는 단정으로 렌더된다(HG-003 C안).
  const isUnverified = isUnverifiedUsageContext(parsedRows);
  const rows = isUnverified ? [] : parsedRows;
  const sentimentChip = SENTIMENT[sentiment].user;
  const isRisky = level === "red" || level === "yellow";
  const noteText = note?.trim() || null;
  // 근거는 실제 데이터일 때만 — 사유가 없다고 등급 일반 문구로 채우지 않는다.
  const cautionText = caution?.trim() || null;
  const verdict = contextVerdict(rows);

  // 밈 고유 신호가 하나도 없으면 카드를 통째로 숨긴다. 남는 건 전 사이트 공통
  // 범례 한 줄뿐이라, 렌더하면 모든 상세가 같은 문장을 반복하는 빈 껍데기가 된다.
  if (!verdict && !noteText && !cautionText) return null;

  return (
    <section
      aria-labelledby="safety-rationale-title"
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="safety-rationale-title" className="text-lg font-bold">
        이 판정의 근거
      </h2>

      {/* (a) 등급 + 판정 문장. usage_context가 있으면 이 밈 전용 문장을 쓰고,
              없을 때만 등급 공통 범례로 물러난다(고유 서술 우선). */}
      <div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="stat-mono">
            <SafetyBadge level={level} />
          </span>
          <span className="text-base leading-relaxed">
            {verdict ?? LEVEL_MEANING[level]}
          </span>
        </p>
        {noteText && (
          <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-muted">
            {noteText}
          </p>
        )}
      </div>

      {/* (b) 상황별 가·불가 — usage_context. 미확인 상태면 확인된 것처럼 보이는
          표 대신 무엇이 없는지 구체적으로 말한다(HG-003 C안). 새 색·글리프는
          만들지 않는다 — doc-status-note.tsx와 같은 bg-surface-2/text-muted,
          SAFETY_LEVELS.gray.icon의 기존 ◌ 글리프를 재사용한다. */}
      {isUnverified ? (
        <div className="rounded-xl bg-surface-2 p-4">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <span aria-hidden>◌</span> 상황별 판정은 아직 확인 전이에요
          </h3>
          <p className="mt-1.5 text-base leading-relaxed text-muted">
            직장·친구·가족·공개 SNS를 나눠서 확인한 기록이 아직 없어요. 위 등급은
            문서 전체에 대한 판정이라 특정 상황에 그대로 적용된다고 보장하지 않아요.
            확인이 끝나면 상황별로 나눠 보여드릴게요.
          </p>
        </div>
      ) : (
        rows.length > 0 && (
          <div>
            <h3 className="text-base font-bold">어디서 써도 될까요?</h3>
            <UsageContextRows rows={rows} />
          </div>
        )
      )}

      {/* (c) sentiment — 논쟁 상태도 판정 근거의 일부 */}
      {sentimentChip && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold"
            style={{
              color: "var(--sent-controversial)",
              background:
                "color-mix(in srgb, var(--sent-controversial) 12%, var(--surface))",
            }}
          >
            <span aria-hidden>◆</span>
            {sentimentChip}
          </span>
          <span className="text-muted">
            커뮤니티 안에서도 평가가 갈리는 상태가 판정에 반영됐어요.
          </span>
        </p>
      )}

      {/* (d) caution — 구체 사유가 없으면 등급 일반 설명으로 폴백 */}
      {cautionText && (
        <div
          className={`hover-glow-flame rounded-xl border border-transparent p-4 ${CAUTION_TONE[isRisky ? (level as "red" | "yellow") : "yellow"]}`}
        >
          <h3 className="flex items-center gap-2 text-base font-bold">
            <span aria-hidden>▲</span> 이건 조심해 주세요
          </h3>
          <p className="mt-1.5 whitespace-pre-line text-base leading-relaxed">
            {cautionText}
          </p>
        </div>
      )}
    </section>
  );
}
