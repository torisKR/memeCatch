import Link from "next/link";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";
import { loadPlusLocalizedFeed } from "@/lib/plus-localized-feed.server";
import type { Locale } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import {
  usesEnglishContentFallback,
} from "@/lib/plus-localized-feed";
import type { MemeCategory } from "@/lib/labels";

/**
 * MY — 관심 카테고리 맞춤 피드 (레인 C).
 * profiles.interests가 있으면 해당 카테고리 급상승 밈을, 없으면(또는 결과가 비면)
 * 최근 등록 밈으로 폴백하고 온보딩 유도 문구를 보여준다.
 * 공개 데이터는 server-only 로더가 쿠키 없는 createStaticClient로만 읽는다.
 */

export async function MyFeed({
  interests,
  locale = "ko",
  isPremium = false,
}: {
  interests: MemeCategory[];
  locale?: Locale;
  isPremium?: boolean;
}) {
  if (!isPremium) return null;

  const copy = PREMIUM_COPY[locale].feed;
  const hasInterests = interests.length > 0;
  const result = await loadPlusLocalizedFeed({ interests, locale, isPremium });
  const contentFallback = usesEnglishContentFallback(locale, result.contentLocale);

  const title = hasInterests && !result.usedFresh ? copy.personalRadar : copy.fresh;
  const emptyCopy =
    result.state === "unavailable"
      ? copy.localizedUnavailable
      : result.state === "empty-coverage"
        ? copy.localizedEmpty
        : copy.empty;

  return (
    <Reveal as="section" className="mt-8 instrument-grid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link
          href="/onboarding?next=/my"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-signal-cyan underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan focus-visible:rounded-md"
        >
          {hasInterests ? copy.editInterests : copy.setInterests}
        </Link>
      </div>
      {contentFallback && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {copy.englishContent}
        </p>
      )}
      {!hasInterests && result.state !== "unavailable" && (
        <p className="mt-2 text-sm text-muted">
          {copy.fallback}
        </p>
      )}
      {result.items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">{emptyCopy}</p>
          <Link
            href="/explore"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.explore}
          </Link>
        </div>
      ) : (
        <MotionList
          as="ul"
          itemAs="li"
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
          itemClassName="min-w-0"
        >
          {result.items.map((item) => (
            <MemeCard key={item.meme.id} meme={item.meme} href={item.href} />
          ))}
        </MotionList>
      )}
    </Reveal>
  );
}
