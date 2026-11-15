import { CategoryTag } from "@/components/category-tag";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";
import { TrackedBlock } from "@/components/tracked-block";
import { SECTION_TITLES } from "@/lib/labels";
import { hasPublicListing } from "@/lib/thin-meme";
import type { WeeklyDigest as WeeklyDigestData } from "@/lib/weekly";

/**
 * 주간 결산 본문 — 급상승 / 신규 등록 / 카테고리 하이라이트 3섹션.
 * 완전 자동 데이터라 섹션별로 비어 있을 수 있음 → 각 섹션이 독립적으로 숨김/폴백.
 * 클릭 추적은 TrackedBlock(캡처 단계)으로 감싸 MemeCard를 그대로 재사용한다.
 */
export function WeeklyDigest({ digest }: { digest: WeeklyDigestData }) {
  const { trending, fresh, categoryBreakdown } = digest;
  const showTrending = hasPublicListing(trending.length);
  const showFresh = hasPublicListing(fresh.length);

  if (!showTrending && !showFresh) return null;

  return (
    <div className="mt-8 flex flex-col gap-10">
      {showTrending && (
        <Reveal as="section">
          <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            <span aria-hidden className="signal-live size-1.5 rounded-full bg-(--signal-cyan)" />
            Trending now
          </p>
          <h2 id="weekly-trending" className="mt-1 text-xl font-extrabold tracking-tight">
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

      {showFresh && (
        <Reveal as="section" delay={0.05}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            New entries
          </p>
          <h2 id="weekly-fresh" className="mt-1 text-xl font-extrabold tracking-tight">
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
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            Category mix
          </p>
          <h2 id="weekly-categories" className="mt-1 text-xl font-extrabold tracking-tight">
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
                  className="instrument-grid h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--surface-2)" }}
                  role="img"
                  aria-label={`${category} 비중 ${percentage}%`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(percentage, 4)}%`,
                      background: "linear-gradient(90deg, var(--flame-400), var(--flame-600))",
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
