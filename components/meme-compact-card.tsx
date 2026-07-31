import Link from "next/link";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { SafetyBadge } from "@/components/safety-badge";
import { SignalTrace } from "@/components/signal-trace";
import { memePathFrom } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";

/** 가로 선반용 카드. 자동 모션 없이 내용과 순위만 빠르게 훑도록 유지한다. */
export function MemeCompactCard({
  meme,
  rank,
  priority = false,
}: {
  meme: MemeListItem;
  rank?: number;
  priority?: boolean;
}) {
  const contents = meme.meme_contents ?? [];
  const thumb =
    contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null;

  return (
    <Link
      href={memePathFrom(meme.short_id, meme.slug)}
      className="group block h-full min-w-0 overflow-hidden rounded-xl border border-border bg-surface transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        <MemeThumbnail
          src={thumb}
          title={meme.title}
          category={meme.category}
          originYear={meme.origin_year}
          priority={priority}
          variant="compact"
        />
        {rank != null && (
          <>
            {/* 계측 화면의 채널 번호처럼 — 모노스페이스 2자리 고정 */}
            <span
              aria-hidden
              className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums shadow-sm ${
                rank <= 3
                  ? "bg-accent-strong text-white"
                  : "border border-white/15 bg-ink/80 text-white/80 backdrop-blur-sm"
              }`}
            >
              {String(rank).padStart(2, "0")}
            </span>
            <span className="sr-only">{rank}위</span>
          </>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 p-3">
        <p className="line-clamp-2 text-sm font-extrabold leading-snug">
          {meme.title}
        </p>
        {/* 시그니처 — 파형 모양이 곧 생애주기다(색 의존 없음) */}
        <SignalTrace status={meme.lifecycle_status} className="w-full" />
        <SafetyBadge level={meme.safety_level} />
      </div>
    </Link>
  );
}
