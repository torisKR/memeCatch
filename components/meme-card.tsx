import { memePathFrom, type MemeCategory } from "@/lib/labels";
import Link from "next/link";
import { SafetyBadge } from "@/components/safety-badge";
import type { MemeListItem, MemeRow } from "@/lib/queries";

/**
 * 밈 카드 — 3단 위계: ①밈명+한 줄 뜻 ②신호등 배지 1개 ③썸네일(4:5).
 * 썸네일 없으면 카테고리별 컬러 플레이스홀더(토큰 기반 color-mix) + 밈명 타이포.
 */
const CATEGORY_TONE: Record<MemeCategory, string> = {
  phrase: "var(--accent)",
  dance: "var(--life-active)",
  song: "var(--sent-controversial)",
  image: "var(--safety-green)",
  comment: "var(--life-cooling)",
  challenge: "var(--safety-red)",
};

export function MemeCard({ meme }: { meme: MemeRow | MemeListItem }) {
  const contents = "meme_contents" in meme ? (meme.meme_contents ?? []) : [];
  const thumb =
    contents.find((c) => c.is_representative && c.thumbnail_url)?.thumbnail_url ??
    contents.find((c) => c.thumbnail_url)?.thumbnail_url ??
    null;
  const tone = CATEGORY_TONE[meme.category];

  return (
    <Link
      href={memePathFrom(meme.short_id, meme.slug)}
      className="group block min-w-0 rounded-xl focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-surface-2">
        {thumb ? (
          // 원격 도메인이 다양해 next/image remotePatterns 대신 img 사용
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-end p-3"
            style={{
              background: `color-mix(in srgb, ${tone} 14%, var(--surface-2))`,
            }}
          >
            <span
              className="line-clamp-4 text-lg font-extrabold leading-snug"
              style={{ color: tone }}
            >
              {meme.title}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <p className="line-clamp-1 text-base font-bold leading-snug">
          {meme.title}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{meme.summary}</p>
        <div className="mt-0.5">
          <SafetyBadge level={meme.safety_level} />
        </div>
      </div>
    </Link>
  );
}
