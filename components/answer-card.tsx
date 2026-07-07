import { LifeGauge } from "@/components/life-gauge";
import { SafetyBadge } from "@/components/safety-badge";
import type { MemeRow } from "@/lib/queries";

/**
 * 정답 카드 — 상세 최상단. 밈명 + 한 줄 뜻 + 생애주기 배지 + 대형 안전 신호등.
 * 375px 첫 뷰포트에 스크롤 없이 들어가도록 컴팩트하게 유지한다.
 */
export function AnswerCard({
  meme,
}: {
  meme: Pick<
    MemeRow,
    "title" | "summary" | "lifecycle_status" | "safety_level"
  >;
}) {
  return (
    <section
      aria-label="정답 카드"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <LifeGauge status={meme.lifecycle_status} />
      <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">
        {meme.title}
      </h1>
      <p className="mt-1.5 text-lg leading-relaxed text-foreground">
        {meme.summary}
      </p>
      <div className="mt-4">
        <SafetyBadge level={meme.safety_level} size="lg" />
      </div>
    </section>
  );
}
