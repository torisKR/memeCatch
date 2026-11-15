"use client";

import Link from "next/link";
import { MemeCard } from "@/components/meme-card";
import { TrackedBlock } from "@/components/tracked-block";
import { useLocale } from "@/lib/i18n-client";
import { AUDIENCE_LABELS_I18N, localizeBrief, PAGE_COPY } from "@/lib/i18n-pages";
import type { Locale } from "@/lib/i18n";
import type { Audience } from "@/lib/meme-news";
import type { MemeNewsBrief } from "@/lib/meme-news";
import type { GenerationHighlight } from "@/lib/queries";
import { hasPublicListing } from "@/lib/thin-meme";

const AUDIENCES = ["20s", "30s", "40s"] as const;

/**
 * /news 본문 — 로케일 의존 카피(PAGE_COPY)를 클라이언트로 분리한 컴포넌트.
 * 서버 페이지(app/news/page.tsx)는 ko 기준 정적(ISR) HTML만 만들고, 사용자
 * 로케일은 useLocale()(쿠키 useSyncExternalStore 복원)로 여기서 표시한다.
 * 데이터(세대별 하이라이트·뉴스 브리핑)는 서버에서 props로 받고, 라벨·머리말만
 * 로케일별로 렌더한다. 언어 선택기(persistLocale 이벤트) 전환 시 즉시 리렌더.
 */
export function NewsPageContent({
  highlights,
  briefs,
}: {
  highlights: Record<Audience, GenerationHighlight[]>;
  briefs: Record<Audience, readonly MemeNewsBrief[]>;
}) {
  const { locale } = useLocale();
  const copy = PAGE_COPY[locale];

  return (
    <>
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">{copy.newsEyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.newsTitle}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          {copy.newsIntro}
        </p>
        <nav aria-label={copy.ageNav} className="mt-5 flex flex-wrap gap-2">
          {AUDIENCES.map((audience) => (
            <a
              key={audience}
              href={`#age-${audience}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent"
            >
              {AUDIENCE_LABELS_I18N[locale][audience]}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-8 space-y-12">
        {AUDIENCES.map((audience) => (
          <AudienceSection
            key={audience}
            audience={audience}
            highlights={highlights[audience]}
            briefs={briefs[audience]}
            locale={locale}
          />
        ))}
      </div>
    </>
  );
}

function AudienceSection({
  audience,
  highlights,
  briefs,
  locale,
}: {
  audience: Audience;
  highlights: GenerationHighlight[];
  briefs: readonly MemeNewsBrief[];
  locale: Locale;
}) {
  const copy = PAGE_COPY[locale];
  const audienceLabel = AUDIENCE_LABELS_I18N[locale][audience];

  return (
    <section id={`age-${audience}`} aria-labelledby={`age-${audience}-title`} className="scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-sm font-semibold text-accent">{audienceLabel} {copy.briefing}</p>
          <h2 id={`age-${audience}-title`} className="mt-1 text-2xl font-extrabold">
            {copy.efficient}
          </h2>
        </div>
        <Link href="/explore" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-accent">
          {copy.exploreAll} <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>

      {hasPublicListing(highlights.length) ? (
        <div className="mt-5">
          <h3 className="text-lg font-bold">{audienceLabel}{copy.known}</h3>
          <p className="mt-1 text-sm text-muted">{copy.voteInfo}</p>
          <TrackedBlock
            event="generation_news_click"
            className="instrument-grid mt-3 rounded-2xl border border-border/60 p-3 sm:p-4"
          >
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <li key={item.meme.id}>
                  <MemeCard meme={item.meme} />
                  <p className="mt-1.5 text-center text-xs text-muted">{copy.votes(item.totalVotes)}</p>
                </li>
              ))}
            </ul>
          </TrackedBlock>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {briefs.map((brief) => (
          <NewsBriefCard key={brief.id} brief={brief} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function NewsBriefCard({ brief, locale }: { brief: MemeNewsBrief; locale: Locale }) {
  const copy = PAGE_COPY[locale];
  const localized = localizeBrief(brief, locale);
  const toneClass = {
    money: "bg-safety-yellow-bg text-safety-yellow",
    safety: "bg-safety-green-bg text-safety-green",
    culture: "bg-accent-soft text-accent",
  }[brief.tone];

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>
        {copy[brief.tone]}
      </span>
      <h3 className="mt-3 text-xl font-extrabold leading-snug">{localized.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{localized.summary}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {localized.checklist.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed">
            <span aria-hidden className="mt-0.5 text-accent">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
        <p className="stat-mono text-signal-cyan">{copy.verified} {brief.verifiedAt}</p>
        <a
          href={brief.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-foreground"
        >
          {copy.source}: {brief.sourceName} <span aria-hidden className="ml-1">↗</span>
        </a>
      </div>
    </article>
  );
}
