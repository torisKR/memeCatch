"use client";

import { useState } from "react";
import { CATEGORIES, type MemeCategory } from "@/lib/labels";
import type { MemeContentRow } from "@/lib/queries";
import { isAvailableContent } from "@/lib/content-availability";
import { isContextSourceUrl } from "@/lib/source-links";
import { sourcePlatformFromReference } from "@/lib/source-platform";

type SocialProvider = "tiktok" | "instagram" | "facebook" | "threads";

type ImmediateSocialEmbed = {
  provider: "tiktok" | "instagram";
  sourceUrl: string;
  embedUrl: string;
};

/**
 * 대표 콘텐츠 임베드.
 * - YouTube + content_id + availability≠dead → lite embed(클릭 시 iframe, sandbox, 지연 로드)
 * - TikTok/Instagram → 공개 URL에서 공식 플레이어 주소를 결정해 즉시 로드
 * - Facebook/Threads → 저장된 안전한 임베드가 없으면 출처 링크로 폴백
 * - 그 외 / 원본 소실 → 폴백 카드 "원본은 사라졌지만…" + 출처 링크
 */
export function MemeEmbed({
  content,
  fallbackSourceUrl,
  fallbackReason = null,
  title,
  isRepresentative = true,
  category,
  originYear,
}: {
  content: Pick<
    MemeContentRow,
    "platform" | "content_id" | "url" | "thumbnail_url" | "availability" | "caption"
  > | null;
  fallbackSourceUrl?: string | null;
  fallbackReason?: "confirmed_unavailable" | "no_playback_reference" | null;
  title: string;
  isRepresentative?: boolean;
  /** 폴백 타이포 히어로의 카테고리 틴트·라벨 칩 — 미전달 시 중립(surface-2) 톤 */
  category?: MemeCategory | null;
  /** 폴백 타이포 히어로의 등장연도 칩 — 미전달 시 칩 생략 */
  originYear?: number | null;
}) {
  const sourcePlatform = sourcePlatformFromReference({
    platform: content?.platform,
    url: content?.url,
  });
  // 재생 가능 여부는 lib/content-availability.ts 단일 판정 — dead와 region_blocked를
  // 함께 제외한다. 불가 판정이면 아래 폴백 카드가 출처 링크를 대신 제시한다.
  const isPlayable = isAvailableContent(content);
  const effectiveFallbackReason =
    fallbackReason ?? (content && !isPlayable ? "confirmed_unavailable" : null);
  const isYouTube =
    content != null &&
    (sourcePlatform === "youtube" || sourcePlatform === "youtube_shorts") &&
    !!content.content_id &&
    isPlayable;

  const sourceUrl = isPlayable
    ? content?.url ?? fallbackSourceUrl ?? null
    : fallbackSourceUrl ?? null;
  const socialProvider = isPlayable
    ? getSocialProvider(content?.platform, sourceUrl)
    : null;
  const socialEmbed =
    socialProvider && sourceUrl
      ? immediateSocialEmbed(socialProvider, sourceUrl)
      : null;

  if (isPlayable && content?.thumbnail_url && !content.url) {
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content.thumbnail_url}
          alt={`${title} 대표 이미지`}
          className="aspect-[4/3] w-full rounded-xl border border-border bg-surface-2 object-cover"
        />
        {content.caption && (
          <figcaption className="mt-2 text-sm text-muted">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (isYouTube) {
    return (
      <figure>
        <LiteYouTube
          videoId={content.content_id as string}
          title={title}
          thumbnailUrl={content.thumbnail_url}
          isShort={content.url?.includes("/shorts/") ?? false}
          isRepresentative={isRepresentative}
        />
        {content.caption && (
          <figcaption className="mt-2 text-sm text-muted">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (socialEmbed) {
    return (
      <figure>
        <LiteSocialEmbed
          embed={socialEmbed}
          title={title}
          isRepresentative={isRepresentative}
        />
        {content?.caption && (
          <figcaption className="mt-2 text-sm text-muted">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (sourceUrl) {
    const isContextSource = isContextSourceUrl(sourceUrl);
    return (
      <TypoFallbackHero title={title} category={category} originYear={originYear}>
        <p className="text-base font-semibold">
          {isContextSource
            ? "맥락 자료 링크가 있어요."
            : effectiveFallbackReason === "confirmed_unavailable"
              ? "원본 콘텐츠 재생 불가."
            : "원본 링크가 있어요."}
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          {isContextSource
            ? "원본 대신 유래와 맥락을 확인하는 참고 출처입니다."
            : effectiveFallbackReason === "confirmed_unavailable"
              ? "비공개이거나 접근할 수 없어 임베드하지 않습니다."
            : "원본을 복제하지 않고 출처 링크로 연결합니다."}
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
        >
            {isContextSource
              ? "출처에서 원본 맥락 보기"
              : effectiveFallbackReason === "confirmed_unavailable"
                ? "출처 상태 확인하기"
                : "출처에서 원본 보기"}
          <span aria-hidden>↗</span>
        </a>
      </TypoFallbackHero>
    );
  }

  return (
    <TypoFallbackHero title={title} category={category} originYear={originYear}>
      <p className="text-base font-semibold">
        {effectiveFallbackReason === "confirmed_unavailable"
          ? "원본 콘텐츠 재생 불가."
          : "재생 가능한 원본 링크 없음."}
      </p>
      <p className="mt-1 text-sm leading-relaxed">
        {effectiveFallbackReason === "confirmed_unavailable"
          ? "비공개이거나 접근할 수 없는 콘텐츠입니다."
          : "현재 연결된 출처가 없습니다."}
      </p>
    </TypoFallbackHero>
  );
}

/**
 * 타이포 폴백 히어로 — 임베드 불가·원본 소실 밈의 대표 콘텐츠 영역.
 * 밈 제목을 대형 타이포 주인공으로 세우고 카테고리 틴트(--cat-*-bg/-text, 다크값
 * 존재·AA 대비)로 채운다. 장식은 히어로 §12 문법의 미세 그리드 + 큰따옴표
 * 워터마크(정적, 저불투명). category 미전달 시 중립 surface-2 톤으로 동일 구조.
 */
function TypoFallbackHero({
  title,
  category,
  originYear,
  children,
}: {
  title: string;
  category?: MemeCategory | null;
  originYear?: number | null;
  children: React.ReactNode;
}) {
  const catMeta = category ? CATEGORIES[category] : null;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border p-6 sm:p-10 ${
        catMeta ? "" : "bg-surface-2"
      }`}
      style={
        category
          ? {
              background: `var(--cat-${category}-bg)`,
              color: `var(--cat-${category}-text)`,
            }
          : undefined
      }
    >
      {/* 미세 그리드 — currentColor 기반, radial 마스크로 좌상단만 은은히 */}
      <div
        aria-hidden
        className="typo-hero-grid pointer-events-none absolute inset-0"
      />
      {/* 큰따옴표 워터마크 — "인용될 만한 말"이라는 사전 정체성 장식 */}
      <QuoteGlyph className="pointer-events-none absolute -right-3 -top-5 h-28 w-28 opacity-[0.09] sm:h-36 sm:w-36" />
      <div className="relative flex min-h-44 flex-col justify-center">
        {(catMeta || originYear != null) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {catMeta && <HeroChip>{catMeta.user}</HeroChip>}
            {/* 「년 등장」은 단정이다. year_precision이 3,904건 전부 unknown이라
                근거가 없고, 같은 정보를 4개 로케일은 이미 "around/ごろ/约在"로
                헤지하고 있다(app/[locale]/memes/[key]/page.tsx). 한국어만 단정할
                이유가 없어 「무렵」으로 맞춘다. 정밀도를 prop으로 넘기지 않는 이유는
                이 칩이 압축 라벨이고, 「무렵」은 정밀도가 올라가도 여전히 참이기 때문. */}
            {originYear != null && <HeroChip>{originYear}년 무렵</HeroChip>}
          </div>
        )}
        <p
          className={`break-keep text-3xl font-black leading-tight tracking-tight sm:text-4xl ${
            catMeta || originYear != null ? "mt-3" : ""
          }`}
        >
          {title}
        </p>
        <div className="mt-4 max-w-prose">{children}</div>
      </div>
    </div>
  );
}

/** 폴백 히어로 메타 칩 — currentColor(카테고리 텍스트 토큰) 기반, AA 유지 */
function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-current/30 px-2.5 py-1 text-xs font-bold tracking-tight">
      {children}
    </span>
  );
}

/** 큰따옴표 SVG(이모지 금지 규칙) — fill: currentColor */
function QuoteGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M10.6 4.9C6.8 7.1 4.6 10.3 4.6 14.2c0 2.8 1.7 4.6 4 4.6 2 0 3.6-1.5 3.6-3.6 0-2-1.4-3.3-3.2-3.3-.3 0-.7 0-.9.1.4-2 2.1-4 4-5.2L10.6 4.9Zm8.9 0c-3.9 2.2-6 5.4-6 9.3 0 2.8 1.7 4.6 4 4.6 2 0 3.5-1.5 3.5-3.6 0-2-1.3-3.3-3.1-3.3-.3 0-.7 0-.9.1.4-2 2-4 4-5.2L19.5 4.9Z" />
    </svg>
  );
}

function getSocialProvider(
  platform?: string | null,
  sourceUrl?: string | null
): SocialProvider | null {
  const hint = `${platform ?? ""} ${sourceUrl ?? ""}`.toLowerCase();
  if (hint.includes("tiktok")) return "tiktok";
  if (hint.includes("instagram")) return "instagram";
  if (hint.includes("facebook") || hint.includes("fb.watch")) return "facebook";
  if (hint.includes("threads")) return "threads";
  return null;
}

function immediateSocialEmbed(
  provider: SocialProvider,
  sourceUrl: string
): ImmediateSocialEmbed | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;

    if (provider === "tiktok" && url.hostname === "www.tiktok.com") {
      const contentId = url.pathname.match(/^\/@[A-Za-z0-9._-]+\/video\/(\d+)/)?.[1];
      if (!contentId) return null;
      return {
        provider,
        sourceUrl,
        embedUrl: `https://www.tiktok.com/player/v1/${contentId}?description=1&music_info=1`,
      };
    }

    if (provider === "instagram" && url.hostname === "www.instagram.com") {
      const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
      if (!match) return null;
      return {
        provider,
        sourceUrl,
        embedUrl: `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function LiteSocialEmbed({
  embed,
  title,
  isRepresentative,
}: {
  embed: ImmediateSocialEmbed;
  title: string;
  isRepresentative: boolean;
}) {
  const { provider, sourceUrl } = embed;

  const providerName = {
    tiktok: "TikTok",
    instagram: "Instagram",
  }[provider];

  const frameWidthClass =
    provider === "tiktok"
      ? "mx-auto w-full max-w-[382px]"
      : "mx-auto w-full max-w-[540px]";
  const frameHeightClass =
    provider === "tiktok"
      ? "h-[min(72svh,680px)]"
      : "h-[min(72svh,720px)]";
  const frameClass = `${frameWidthClass} ${frameHeightClass}`;

  // 플랫폼 구분은 사이드 스트라이프(색상 강조 보더) 대신 라벨 텍스트 + 은은한 전체
  // 테두리로 전달 — 디자인 시스템에서 사이드 스트라이프 악센트는 금지
  const sourceTape = (
    <div
      className={`hover-glow-flame ${frameWidthClass} flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm`}
    >
      <span className="font-bold tracking-tight">{providerName}</span>
      {!isRepresentative && (
        <span className="text-muted">밈 사용 예시</span>
      )}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex min-h-11 items-center font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        게시물 열기 <span aria-hidden>↗</span>
      </a>
    </div>
  );

  return (
    <div className="space-y-2">
      {sourceTape}
      <iframe
        src={embed.embedUrl}
        title={`${title} — ${providerName} ${isRepresentative ? "대표 콘텐츠" : "관련 콘텐츠"}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        // 서드파티 임베드 내부가 흰 배경이라 다크 모드에서도 흰 컨테이너 유지 — 내부/외부 불일치 방지
        className={`${frameClass} block rounded-2xl border border-border bg-white shadow-sm`}
      />
    </div>
  );
}

function LiteYouTube({
  videoId,
  title,
  thumbnailUrl,
  isShort,
  isRepresentative,
}: {
  videoId: string;
  title: string;
  thumbnailUrl?: string | null;
  isShort: boolean;
  isRepresentative: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const thumb =
    thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  /**
   * 대표 영상은 처음부터 실제 iframe을 DOM에 둔다.
   * 파사드(클릭 시 iframe)는 Googlebot이 클릭하지 않아 페이지에 플레이어가 없고,
   * VideoObject 마크업과 어긋나 서치콘솔 '동영상이 보기 페이지에 없음'을 유발했다.
   * loading="lazy"로 뷰포트 근처에 올 때까지 네트워크 로드는 지연한다.
   * 관련 영상은 그대로 파사드 — 페이지당 무거운 임베드는 1개로 제한.
   */
  const showIframe = isRepresentative || playing;

  return (
    <div
      className={`relative max-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2 ${
        isShort ? "mx-auto aspect-[9/16] w-full max-w-[394px]" : "aspect-video w-full"
      }`}
    >
      {showIframe ? (
        <iframe
          // autoplay는 파사드를 눌러 들어온 경우에만 — 대표 영상 최초 렌더는 자동재생 없음
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0${playing ? "&autoplay=1" : ""}`}
          title={`${title} — ${isRepresentative ? "대표 영상" : "관련 영상"}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`${title} ${isRepresentative ? "대표 영상" : "관련 영상"} 재생`}
          className="group relative block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="hover-glow-flame flex h-16 w-16 items-center justify-center rounded-full bg-background/85 shadow-lg transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="ml-1 h-7 w-7 text-accent"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
