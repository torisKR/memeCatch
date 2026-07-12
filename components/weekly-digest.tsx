import { CategoryTag } from "@/components/category-tag";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";
import { TrackedBlock } from "@/components/tracked-block";
import { SECTION_TITLES } from "@/lib/labels";
import type { WeeklyDigest as WeeklyDigestData } from "@/lib/weekly";

/**
 * 주간 결산 본문 — 급상승 / 신규 등록 / 카테고리 하이라이트 3섹션.
 * 완전 자동 데이터라 섹션별로 비어 있을 수 있음 → 각 섹션이 독립적으로 숨김/폴백.
 * 클릭 추적은 TrackedBlock(캡처 단계)으로 감싸 MemeCard를 그대로 재사용한다.
 */
export function WeeklyDigest({ digest }: { digest: WeeklyDigestData }) {
  const { trending, fresh, categoryBreakdown } = digest;
  const hasAny = trending.length > 0 || fresh.length > 0;

  if (!hasAny) {
    return (
      <p className="mt-8 rounded-2xl border border-border bg-surface p-6 text-base text-muted">
        이번 주 결산은 아직 준비 중이에요. 데이터가 쌓이는 대로 채워질 거예요.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      {trending.length > 0 && (
        <Reveal as="section">
          <h2 id="weekly-trending" className="text-xl font-extrabold tracking-tight">
            지금 가장 뜨거운 밈
          </h2>
          <p className="mt-1 text-sm text-muted">
            최근 72시간 화제성 상위 {trending.length}건 — 이번 주 결산과 함께 확인해요.
          </p>
          <TrackedBlock event="weekly_click" className="mt-4">
            <MotionList
              as="ul"
              itemAs="li"
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
              itemClassName="min-w-0"
            >
              {trending.map((meme) => (
                <MemeCard key={meme.id} meme={meme} />
              ))}
            </MotionList>
          </TrackedBlock>
        </Reveal>
      )}

      {fresh.length > 0 && (
        <Reveal as="section" delay={0.05}>
          <h2 id="weekly-fresh" className="text-xl font-extrabold tracking-tight">
            {SECTION_TITLES.fresh}
          </h2>
          <p className="mt-1 text-sm text-muted">
            이번 주에 새로 등록된 밈 {fresh.length}건이에요.
          </p>
          <TrackedBlock event="weekly_click" className="mt-4">
            <MotionList
              as="ul"
              itemAs="li"
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              itemClassName="min-w-0"
            >
              {fresh.map((meme) => (
                <MemeCard key={meme.id} meme={meme} />
              ))}
            </MotionList>
          </TrackedBlock>
        </Reveal>
      )}

      {categoryBreakdown.length > 0 && (
        <Reveal as="section" delay={0.1}>
          <h2 id="weekly-categories" className="text-xl font-extrabold tracking-tight">
            카테고리 하이라이트
          </h2>
          <p className="mt-1 text-sm text-muted">
            이번 주 급상승·신규 밈을 카테고리별로 모아봤어요.
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {categoryBreakdown.map(({ category, count, percentage }) => (
              <li key={category} className="flex items-center gap-3">
                <CategoryTag category={category} className="shrink-0" />
                <div
                  className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--surface-2)" }}
                  role="img"
                  aria-label={`${category} 비중 ${percentage}%`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(percentage, 4)}%`,
                      backgroundColor: `var(--cat-${category}-text)`,
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-muted">
                  {count}건 · {percentage}%
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
