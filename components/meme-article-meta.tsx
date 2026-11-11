import Image from "next/image";
import Link from "next/link";
import { isPublicMemeArtPath, memeArtAlt } from "@/lib/meme-poster";

export const ARTICLE_COLUMN = "mx-auto w-full max-w-[680px]";
export const ARTICLE_BODY = "text-[17px] leading-[1.75]";

/** Seoul calendar day, YYYY-MM-DD. Invalid timestamps stay unset. */
export function articleDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const REVIEWED_LABEL = {
  ko: "최종 검토일",
  en: "Last reviewed",
  ja: "最終確認日",
  zh: "最后审阅",
  "zh-tw": "最後審閱",
} as const;

type ReviewedLocale = keyof typeof REVIEWED_LABEL;

/** Seoul calendar day in the page language. Invalid timestamps stay unset. */
export function reviewedDateLabel(
  value: string | null | undefined,
  locale: ReviewedLocale = "ko",
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatLocale =
    locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : locale === "zh-tw" ? "zh-TW" : "en-US";
  return new Intl.DateTimeFormat(formatLocale, {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Byline under the article title. The name links to the editorial policy. */
export function MemeByline({
  updatedAt,
  reviewedAt,
  reviewedLocale = "ko",
}: {
  updatedAt?: string | null;
  /** Set only on pages that pass the index gate. */
  reviewedAt?: string | null;
  reviewedLocale?: ReviewedLocale;
}) {
  const updated = articleDate(updatedAt);
  const reviewed = reviewedDateLabel(reviewedAt, reviewedLocale);
  const reviewedIso = articleDate(reviewedAt);
  return (
    <p className="mt-2 text-sm text-muted">
      <Link href="/editorial" className="font-medium underline decoration-border underline-offset-4 hover:text-foreground">
        작성 toris
      </Link>
      <span>
        {" · "}
        {updated ? (
          <>
            최종 수정 <time dateTime={updated}>{updated}</time>
          </>
        ) : (
          "최종 수정일"
        )}
      </span>
      {reviewed ? (
        <span className="mt-1 block">
          {REVIEWED_LABEL[reviewedLocale]}
          {": "}
          <time dateTime={reviewedIso ?? undefined}>{reviewed}</time>
        </span>
      ) : null}
    </p>
  );
}

export function MemeArticleFooter() {
  return (
    <footer className="mt-10 border-t border-border pt-6 text-sm">
      <Link
        href="/editorial"
        className="inline-flex min-h-11 items-center font-medium underline decoration-border underline-offset-4 hover:text-foreground"
      >
        편집 방침
      </Link>
    </footer>
  );
}

/** Text-free illustration. The title stays in the article, so a missing image renders nothing. */
export function MemeArticleArt({
  title,
  artUrl,
}: {
  title: string;
  artUrl?: string | null;
}) {
  if (!isPublicMemeArtPath(artUrl)) return null;
  return (
    <Image
      src={artUrl}
      alt={memeArtAlt(title)}
      width={640}
      height={480}
      priority
      sizes="(min-width: 680px) 680px, 100vw"
      className="mb-5 aspect-[4/3] w-full rounded-2xl object-cover"
    />
  );
}
