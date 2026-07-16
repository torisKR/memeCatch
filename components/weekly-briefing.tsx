import Link from "next/link";
import { memePathFrom } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";
import { SafetyBadge } from "@/components/safety-badge";
import { TrackedBlock } from "@/components/tracked-block";

/**
 * 홈 브리핑 — "요즘 뜨는 새 밈" (CTO 피드백: 밈알못 최우선 요약).
 * 급상승 캐러셀(카드 나열)과 달리 텍스트 중심의 "읽는 브리핑" 카드 1장.
 * 데이터는 홈이 getLatestMemes(유래 연도 최신순)로 넘긴 것 — 이미 정렬됨.
 * 상위 3개를 "N. 제목 (연도) — 한 줄 요약 + 신호등" 리스트로 보여준다.
 * (DB에 유래는 연 단위로만 기록돼 '이번 달'까지는 특정 불가 — 최신 연도 우선.)
 * 서버 컴포넌트. 클릭 추적은 TrackedBlock(briefing_click) 캡처로 처리.
 */
export function WeeklyBriefing({ memes }: { memes: MemeListItem[] }) {
  const top3 = memes.slice(0, 3);
  if (top3.length < 3) return null;

  return (
    <TrackedBlock event="briefing_click">
      <section
        aria-labelledby="sec-briefing"
        className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-text"
          >
            {/* 브리핑 노트 — 체크 리스트 아이콘 (이모지 금지) */}
            <svg
              viewBox="0 0 24 24"
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="m8.5 8 1.2 1.2 2.3-2.2" />
              <path d="M14 8.5h2.5" />
              <path d="m8.5 13.5 1.2 1.2 2.3-2.2" />
              <path d="M14 14h2.5" />
            </svg>
          </span>
          <h2 id="sec-briefing" className="text-xl font-bold">
            요즘 뜨는 새 밈, 이것만 알면 됩니다
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          가장 최근에 등장한 밈부터. 대화에서 이 얘기 나오면 이런 뜻이에요.
        </p>

        <ol className="mt-3 divide-y divide-border">
          {top3.map((meme, i) => (
            <li key={meme.id}>
              <Link
                href={memePathFrom(meme.short_id, meme.slug)}
                className="group flex min-h-11 items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-center font-mono text-sm font-bold text-accent-text"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
                  <span className="font-bold transition-colors group-hover:text-accent-text">
                    {meme.title}
                  </span>
                  {meme.origin_year != null && (
                    <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 align-middle text-xs font-bold tabular-nums text-muted">
                      {meme.origin_year}
                    </span>
                  )}
                  {meme.summary && (
                    <span className="text-muted"> — {meme.summary}</span>
                  )}
                </span>
                <span className="shrink-0">
                  <SafetyBadge level={meme.safety_level} />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {/* 밈알못 여정 연결 — 주간 결산·밈력 테스트 보조 링크 */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
          <Link
            href="/weekly"
            prefetch={false}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            주간 결산 전체 보기 <span aria-hidden>&nbsp;→</span>
          </Link>
          <Link
            href="/quiz"
            prefetch={false}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            내 밈력 테스트 <span aria-hidden>&nbsp;→</span>
          </Link>
        </div>
      </section>
    </TrackedBlock>
  );
}
