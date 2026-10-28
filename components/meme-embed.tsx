"use client";

import { useState } from "react";
import { CATEGORIES, type MemeCategory } from "@/lib/labels";
import type { MemeContentRow } from "@/lib/queries";
import { isAvailableContent } from "@/lib/content-availability";
import { isContextSourceUrl } from "@/lib/source-links";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import { getSeoCopy, type SeoRouteLocale } from "@/lib/i18n-routing";

type EmbedCopy = {
  contextTitle: string;
  unavailableTitle: string;
  sourceTitle: string;
  contextBody: string;
  unavailableBody: string;
  sourceBody: string;
  contextCta: string;
  unavailableCta: string;
  sourceCta: string;
  noSourceTitle: string;
  unavailableContentBody: string;
  noSourceBody: string;
  relatedContent: string;
  aroundYear: (year: number) => string;
  imageAlt: (title: string) => string;
  usageExample: string;
  openPost: string;
  representativeContent: string;
  representativeVideo: string;
  relatedVideo: string;
  play: (label: string) => string;
};

/** 다국어 상세 페이지에서 한국어 안내 문구가 섞이지 않도록 로케일별 문구를 둔다. */
const EMBED_COPY: Record<SeoRouteLocale, EmbedCopy> = {
  ko: {
    contextTitle: "맥락 자료 링크가 있어요.",
    unavailableTitle: "원본 콘텐츠 재생 불가.",
    sourceTitle: "원본 링크가 있어요.",
    contextBody: "원본 대신 유래와 맥락을 확인하는 참고 출처입니다.",
    unavailableBody: "비공개이거나 접근할 수 없어 임베드하지 않습니다.",
    sourceBody: "원본을 복제하지 않고 출처 링크로 연결합니다.",
    contextCta: "출처에서 원본 맥락 보기",
    unavailableCta: "출처 상태 확인하기",
    sourceCta: "출처에서 원본 보기",
    noSourceTitle: "재생 가능한 원본 링크 없음.",
    unavailableContentBody: "비공개이거나 접근할 수 없는 콘텐츠입니다.",
    noSourceBody: "현재 연결된 출처가 없습니다.",
    relatedContent: "관련 콘텐츠",
    aroundYear: (year) => `${year}년 무렵`,
    imageAlt: (title) => `${title} 대표 이미지`,
    usageExample: "밈 사용 예시",
    openPost: "게시물 열기",
    representativeContent: "대표 콘텐츠",
    representativeVideo: "대표 영상",
    relatedVideo: "관련 영상",
    play: (label) => `${label} 재생`,
  },
  en: {
    contextTitle: "Context source available.",
    unavailableTitle: "The original can't be played.",
    sourceTitle: "Original link available.",
    contextBody: "A reference that explains the origin and context, not the original post.",
    unavailableBody: "It is private or unavailable, so we don't embed it.",
    sourceBody: "We link to the source instead of copying the original.",
    contextCta: "See the context at the source",
    unavailableCta: "Check the source",
    sourceCta: "See the original at the source",
    noSourceTitle: "No playable original link.",
    unavailableContentBody: "This content is private or unavailable.",
    noSourceBody: "No source is linked yet.",
    relatedContent: "Related content",
    aroundYear: (year) => `around ${year}`,
    imageAlt: (title) => `${title} main image`,
    usageExample: "Usage example",
    openPost: "Open post",
    representativeContent: "main content",
    representativeVideo: "main video",
    relatedVideo: "related video",
    play: (label) => `Play ${label}`,
  },
  ja: {
    contextTitle: "背景資料へのリンクがあります。",
    unavailableTitle: "元のコンテンツは再生できません。",
    sourceTitle: "元のリンクがあります。",
    contextBody: "元の投稿ではなく、由来と背景を確認するための参考資料です。",
    unavailableBody: "非公開またはアクセスできないため、埋め込みません。",
    sourceBody: "元のコンテンツは複製せず、出典へリンクします。",
    contextCta: "出典で背景を見る",
    unavailableCta: "出典を確認する",
    sourceCta: "出典で元を見る",
    noSourceTitle: "再生できる元のリンクはありません。",
    unavailableContentBody: "非公開またはアクセスできないコンテンツです。",
    noSourceBody: "まだ出典が登録されていません。",
    relatedContent: "関連コンテンツ",
    aroundYear: (year) => `${year}年ごろ`,
    imageAlt: (title) => `${title}の代表画像`,
    usageExample: "使用例",
    openPost: "投稿を開く",
    representativeContent: "代表コンテンツ",
    representativeVideo: "代表動画",
    relatedVideo: "関連動画",
    play: (label) => `${label}を再生`,
  },
  zh: {
    contextTitle: "有背景资料链接。",
    unavailableTitle: "原内容无法播放。",
    sourceTitle: "有原始链接。",
    contextBody: "这是说明来源和背景的参考资料，不是原始帖子。",
    unavailableBody: "内容为私密或无法访问，因此不嵌入。",
    sourceBody: "我们不复制原内容，只链接到出处。",
    contextCta: "到出处查看背景",
    unavailableCta: "查看出处状态",
    sourceCta: "到出处查看原内容",
    noSourceTitle: "没有可播放的原始链接。",
    unavailableContentBody: "该内容为私密或无法访问。",
    noSourceBody: "目前还没有关联出处。",
    relatedContent: "相关内容",
    aroundYear: (year) => `约${year}年`,
    imageAlt: (title) => `${title}代表图片`,
    usageExample: "使用示例",
    openPost: "打开帖子",
    representativeContent: "代表内容",
    representativeVideo: "代表视频",
    relatedVideo: "相关视频",
    play: (label) => `播放${label}`,
  },
  "zh-tw": {
    contextTitle: "有背景資料連結。",
    unavailableTitle: "原內容無法播放。",
    sourceTitle: "有原始連結。",
    contextBody: "這是說明來源和背景的參考資料，不是原始貼文。",
    unavailableBody: "內容為私密或無法存取，因此不嵌入。",
    sourceBody: "我們不複製原內容，只連結到出處。",
    contextCta: "到出處查看背景",
    unavailableCta: "查看出處狀態",
    sourceCta: "到出處查看原內容",
    noSourceTitle: "沒有可播放的原始連結。",
    unavailableContentBody: "該內容為私密或無法存取。",
    noSourceBody: "目前還沒有關聯出處。",
    relatedContent: "相關內容",
    aroundYear: (year) => `約${year}年`,
    imageAlt: (title) => `${title}代表圖片`,
    usageExample: "使用範例",
    openPost: "開啟貼文",
    representativeContent: "代表內容",
    representativeVideo: "代表影片",
    relatedVideo: "相關影片",
    play: (label) => `播放${label}`,
  },
};

function categoryLabel(locale: SeoRouteLocale, category: MemeCategory): string {
  return locale === "ko" ? CATEGORIES[category].user : getSeoCopy(locale).categories[category];
}

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
  locale = "ko",
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
  /** 안내 문구 언어. 다국어 상세 페이지는 반드시 전달한다. */
  locale?: SeoRouteLocale;
}) {
  const copy = EMBED_COPY[locale];
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
          alt={copy.imageAlt(title)}
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
          copy={copy}
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
          copy={copy}
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
      <TypoFallbackHero title={title} category={category} originYear={originYear} locale={locale}>
        <p className="text-base font-semibold">
          {isContextSource
            ? copy.contextTitle
            : effectiveFallbackReason === "confirmed_unavailable"
              ? copy.unavailableTitle
            : copy.sourceTitle}
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          {isContextSource
            ? copy.contextBody
            : effectiveFallbackReason === "confirmed_unavailable"
              ? copy.unavailableBody
            : copy.sourceBody}
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
        >
            {isContextSource
              ? copy.contextCta
              : effectiveFallbackReason === "confirmed_unavailable"
                ? copy.unavailableCta
                : copy.sourceCta}
          <span aria-hidden>↗</span>
        </a>
      </TypoFallbackHero>
    );
  }

  return (
    <TypoFallbackHero title={title} category={category} originYear={originYear} locale={locale}>
      <p className="text-base font-semibold">
        {effectiveFallbackReason === "confirmed_unavailable"
          ? copy.unavailableTitle
          : copy.noSourceTitle}
      </p>
      <p className="mt-1 text-sm leading-relaxed">
        {effectiveFallbackReason === "confirmed_unavailable"
          ? copy.unavailableContentBody
          : copy.noSourceBody}
      </p>
    </TypoFallbackHero>
  );
}

/** 재생 불가 상태는 출처로 이어지는 작은 안내로 표시한다. */
function TypoFallbackHero({
  title,
  category,
  originYear,
  locale,
  children,
}: {
  title: string;
  category?: MemeCategory | null;
  originYear?: number | null;
  locale: SeoRouteLocale;
  children: React.ReactNode;
}) {
  const copy = EMBED_COPY[locale];
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-5">
      <p className="text-xs text-muted">
        {category ? categoryLabel(locale, category) : copy.relatedContent}
        {originYear != null && <span> · {copy.aroundYear(originYear)}</span>}
      </p>
      <p className="mt-2 text-base font-semibold">{title}</p>
      <div className="mt-3 text-sm">{children}</div>
    </div>
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
  copy,
}: {
  embed: ImmediateSocialEmbed;
  title: string;
  isRepresentative: boolean;
  copy: EmbedCopy;
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
        <span className="text-muted">{copy.usageExample}</span>
      )}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex min-h-11 items-center font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copy.openPost} <span aria-hidden>↗</span>
      </a>
    </div>
  );

  return (
    <div className="space-y-2">
      {sourceTape}
      <iframe
        src={embed.embedUrl}
        title={`${title} — ${providerName} ${isRepresentative ? copy.representativeContent : copy.relatedContent}`}
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
  copy,
}: {
  videoId: string;
  title: string;
  thumbnailUrl?: string | null;
  isShort: boolean;
  isRepresentative: boolean;
  copy: EmbedCopy;
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
          title={`${title} — ${isRepresentative ? copy.representativeVideo : copy.relatedVideo}`}
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
          aria-label={copy.play(`${title} ${isRepresentative ? copy.representativeVideo : copy.relatedVideo}`)}
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
