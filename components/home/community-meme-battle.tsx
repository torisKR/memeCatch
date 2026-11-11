"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Heart, MessageCircle, Trophy } from "lucide-react";
import {
  BATTLE_PERIOD_LABELS,
  type BattleBoard,
  type BattlePeriod,
} from "@/lib/community-battle";

/**
 * 홈 오른쪽에 고정되는 커뮤니티 밈대결 패널.
 * 오늘·이번 주·이번 달 좋아요 순위를 탭으로 바꿔 보고, 상위 1% 후보는 표시를 단다.
 * 상위 1%는 기간이 끝나면 운영자 검수 대기(meme_submissions)로 넘어간다.
 */
/** Today stays first only when it has entries. An empty today opens on this week. */
export function initialBattlePeriod(boards: readonly BattleBoard[]): BattlePeriod {
  const today = boards.find((board) => board.period === "day");
  if (today && today.status === "ready" && today.entries.length > 0) return "day";
  if (boards.some((board) => board.period === "week")) return "week";
  return boards[0]?.period ?? "day";
}

export function CommunityMemeBattle({ boards }: { boards: readonly BattleBoard[] }) {
  const baseId = useId();
  const [active, setActive] = useState<BattlePeriod>(initialBattlePeriod(boards));
  const board = boards.find((item) => item.period === active) ?? boards[0];
  if (!board || boards.every((item) => item.status === "unavailable")) return null;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-border bg-surface p-4 text-foreground"
    >
      <div className="flex items-center gap-2">
        <Trophy aria-hidden className="h-5 w-5 text-accent" />
        <h2 id={`${baseId}-title`} className="text-base font-bold">
          밈대결
        </h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">
        좋아요를 가장 많이 받은 밈이 이겨요. 기간마다 상위 1%는 검수를 거쳐 밈 사전에 올라가요.
      </p>

      <div role="tablist" aria-label="밈대결 기간" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {boards.map((item) => {
          const selected = item.period === active;
          return (
            <button
              key={item.period}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.period}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setActive(item.period)}
              className={`min-h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {BATTLE_PERIOD_LABELS[item.period]}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${board.period}`}
        className="mt-3"
      >
        {board.status === "unavailable" || board.entries.length === 0 ? (
          <p className="py-4 text-base leading-7 text-foreground">
            {BATTLE_PERIOD_LABELS[board.period]} 올라온 밈이 아직 없어요. 첫 밈을 올려 보세요.
          </p>
        ) : (
          <>
            <ol className="space-y-1">
              {board.entries.map((entry) => (
                <li key={entry.postId}>
                  <Link
                    href={`/community/${entry.postId}`}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums">{entry.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{entry.title}</span>
                      {entry.isPromotionCandidate && (
                        <span className="mt-0.5 inline-flex rounded-full border border-accent px-2 text-xs font-semibold text-accent">
                          상위 1% 후보
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-0.5">
                        <Heart aria-hidden className="h-3.5 w-3.5" />
                        <span className="sr-only">좋아요</span>
                        {entry.likeCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle aria-hidden className="h-3.5 w-3.5" />
                        <span className="sr-only">댓글</span>
                        {entry.commentCount}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">
              참가 {board.totalPosts}개 중 상위 {board.promotionCount}개가 밈 사전 후보예요.
            </p>
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/community/new"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          밈 올리기
        </Link>
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          투표하러 가기
        </Link>
      </div>
    </section>
  );
}
