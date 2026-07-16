import { SENTIMENT, type SafetyLevel } from "@/lib/labels";
import type { Database, Json } from "@/lib/database.types";
import { SafetyBadge } from "@/components/safety-badge";
import {
  UsageContextRows,
  parseUsageContext,
} from "@/components/usage-guide";

type Sentiment = Database["public"]["Enums"]["meme_sentiment"];

/**
 * 등급별 판정 기준 한 줄 — 밈 개별 사실이 아니라 신호등 산정 규칙 설명.
 * 개별 근거는 usage_note·caution 필드만 사용(별도 '근거' 데이터 발명 금지).
 */
const LEVEL_MEANING: Record<SafetyLevel, string> = {
  green:
    "커뮤니티 사용례에서 부정적 맥락 없이 널리 쓰이는 것으로 확인된 등급이에요.",
  yellow:
    "맥락에 따라 오해나 불쾌감을 줄 수 있어 상황을 가려 써야 하는 등급이에요.",
  gray: "유행이 지나 지금 쓰면 어색하게 들릴 수 있는 등급이에요.",
  red: "비하·혐오 등 부정적 맥락과 결합해 사용 자체를 권하지 않는 등급이에요.",
};

/** caution이 비어 있는 red/yellow 폴백 — 등급 일반 설명(개별 사유 발명 금지) */
const CAUTION_FALLBACK =
  "커뮤니티 사용례에서 비하·논쟁 맥락이 확인된 등급이에요.";

const CAUTION_TONE: Record<"red" | "yellow", string> = {
  red: "bg-safety-red-bg text-safety-red",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
};

/**
 * "이 판정의 근거" — 상세에 흩어져 있던 신호등·usage_note·caution·sentiment를
 * 판정 근거 서사 한 카드로 구조화(CTO 피드백: '안 되는 것'과 그 근거).
 * (a) 등급+의미 한 줄 → 근거 문장(usage_note)
 * (b) 상황별 가·불가(usage_context — UsageGuide의 행 목록 재사용)
 * (c) sentiment(논쟁 중) 보조 칩
 * (d) caution — red/yellow인데 caution이 없으면 등급 일반 설명으로 폴백
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
  const rows = parseUsageContext(context);
  const sentimentChip = SENTIMENT[sentiment].user;
  const isRisky = level === "red" || level === "yellow";
  const cautionText = caution || (isRisky ? CAUTION_FALLBACK : null);

  return (
    <section
      aria-labelledby="safety-rationale-title"
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="safety-rationale-title" className="text-lg font-bold">
        이 판정의 근거
      </h2>

      {/* (a) 등급과 그 의미 + 근거 문장(usage_note) */}
      <div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <SafetyBadge level={level} />
          <span className="text-base leading-relaxed">
            {LEVEL_MEANING[level]}
          </span>
        </p>
        {note && (
          <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-muted">
            {note}
          </p>
        )}
      </div>

      {/* (b) 상황별 가·불가 — usage_context */}
      {rows.length > 0 && (
        <div>
          <h3 className="text-base font-bold">어디서 써도 될까요?</h3>
          <UsageContextRows rows={rows} />
        </div>
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
          className={`rounded-xl p-4 ${CAUTION_TONE[isRisky ? (level as "red" | "yellow") : "yellow"]}`}
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
