"use client";

import { useState } from "react";
import type { MemeContentRow } from "@/lib/queries";
import { isContextSourceUrl } from "@/lib/source-links";

type SocialProvider = "tiktok" | "instagram" | "facebook" | "threads";

type OEmbedResponse = {
  provider: SocialProvider;
  sourceUrl: string;
  embedUrl: string | null;
  embedHtml: string | null;
  contentId: string | null;
  title: string | null;
  authorName: string | null;
};

/**
 * 대표 콘텐츠 임베드.
 * - YouTube + content_id + availability≠dead → lite embed(클릭 시 iframe, sandbox, 지연 로드)
 * - TikTok/Instagram/Facebook/Threads → 클릭 시 서버 oEmbed 검증 후 공식 플레이어
 * - 그 외 / 원본 소실 → 폴백 카드 "원본은 사라졌지만…" + 출처 링크
 */
export function MemeEmbed({
  content,
  fallbackSourceUrl,
  title,
  isRepresentative = true,
}: {
  content: Pick<
    MemeContentRow,
    "platform" | "content_id" | "url" | "thumbnail_url" | "availability" | "caption"
  > | null;
  fallbackSourceUrl?: string | null;
  title: string;
  isRepresentative?: boolean;
}) {
  const isYouTube =
    content != null &&
    content.platform?.toLowerCase() === "youtube" &&
    !!content.content_id &&
    content.availability !== "dead";

  const sourceUrl = content?.url ?? fallbackSourceUrl ?? null;
  const socialProvider =
    content?.availability !== "dead"
      ? getSocialProvider(content?.platform, sourceUrl)
      : null;

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

  if (socialProvider && sourceUrl) {
    return (
      <figure>
        <LiteSocialEmbed
          provider={socialProvider}
          sourceUrl={sourceUrl}
          title={title}
          thumbnailUrl={content?.thumbnail_url}
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

  // 출처가 있으면 "확인 가능" 톤, 정말 없을 때만 "소실" 톤 — 오해 방지
  if (sourceUrl) {
    const isContextSource = isContextSourceUrl(sourceUrl);
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <p className="text-base font-semibold">
          {isContextSource
            ? "원본 맥락은 출처에서 확인할 수 있어요."
            : "원본 콘텐츠는 출처에서 볼 수 있어요."}
        </p>
        <p className="mt-1 text-base text-muted">
          {isContextSource
            ? "이 링크는 원본을 복제하지 않고 유래와 맥락을 설명하는 참고 출처예요."
            : "저작권 보호를 위해 원본을 복제하지 않고 링크로 연결해요."}
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold transition-colors hover:border-accent hover:text-accent"
        >
          {isContextSource ? "출처에서 원본 맥락 보기" : "출처에서 원본 보기"}
          <span aria-hidden>↗</span>
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-5">
      <p className="text-base font-semibold">
        원본은 사라졌지만, 뜻과 맥락은 여기 남아 있어요.
      </p>
      <p className="mt-1 text-base text-muted">
        플랫폼에서 내려갔거나 임베드가 어려운 콘텐츠예요. 아래 설명이 이 밈의
        기록이에요.
      </p>
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

function isTrustedEmbedUrl(provider: SocialProvider, rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "tiktok") {
      return url.hostname === "www.tiktok.com" && url.pathname.startsWith("/player/v1/");
    }
    if (provider === "instagram") {
      return url.hostname === "www.instagram.com" && url.pathname.endsWith("/embed/captioned/");
    }
    if (provider === "threads") return false;
    return url.hostname === "www.facebook.com" && url.pathname.startsWith("/plugins/");
  } catch {
    return false;
  }
}

function LiteSocialEmbed({
  provider,
  sourceUrl,
  title,
  thumbnailUrl,
  isRepresentative,
}: {
  provider: SocialProvider;
  sourceUrl: string;
  title: string;
  thumbnailUrl?: string | null;
  isRepresentative: boolean;
}) {
  const [embed, setEmbed] = useState<OEmbedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const providerName = {
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    threads: "Threads",
  }[provider];

  async function loadEmbed() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oembed?url=${encodeURIComponent(sourceUrl)}`);
      const data = (await response.json()) as OEmbedResponse | { error?: string };
      if (!response.ok || !("embedUrl" in data)) {
        throw new Error("error" in data ? data.error : undefined);
      }
      const hasTrustedEmbed =
        provider === "threads"
          ? typeof data.embedHtml === "string" && data.embedHtml.length > 0
          : typeof data.embedUrl === "string" &&
            isTrustedEmbedUrl(provider, data.embedUrl);
      if (data.provider !== provider || !hasTrustedEmbed) {
        throw new Error("안전한 임베드 주소를 확인하지 못했습니다.");
      }
      setEmbed(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error && loadError.message
          ? loadError.message
          : "콘텐츠를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  if (embed) {
    const frameClass =
      provider === "tiktok"
        ? "mx-auto aspect-[9/16] w-full max-w-[605px]"
        : provider === "instagram"
          ? "mx-auto h-[760px] w-full max-w-[658px]"
          : provider === "threads"
            ? "mx-auto h-[700px] w-full max-w-[658px]"
            : "mx-auto h-[600px] w-full max-w-[658px]";
    const threadsDocument = embed.embedHtml
      ? `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${embed.embedHtml}</body></html>`
      : undefined;
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <iframe
          src={embed.embedUrl ?? undefined}
          srcDoc={threadsDocument}
          title={`${title} — ${providerName} ${isRepresentative ? "대표 콘텐츠" : "관련 콘텐츠"}`}
          sandbox={
            provider === "threads"
              ? "allow-scripts allow-popups allow-popups-to-escape-sandbox"
              : "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          }
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className={`${frameClass} border-0 bg-white`}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-72 overflow-hidden rounded-xl border border-border bg-surface-2">
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-35 blur-[1px]"
        />
      )}
      <div className="relative flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-background/90 px-3 py-1 text-sm font-semibold">
            {providerName}
          </span>
          {!isRepresentative && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
              사용 예시
            </span>
          )}
        </div>
        <p className="max-w-md text-base font-semibold">
          재생하면 {providerName}에서 {isRepresentative ? "콘텐츠" : "관련 콘텐츠"}를
          불러옵니다.
        </p>
        {!isRepresentative && (
          <p className="max-w-md text-sm text-muted">
            이 게시물은 밈의 원본이 아닌 사용 예시예요.
          </p>
        )}
        <button
          type="button"
          onClick={loadEmbed}
          disabled={loading}
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {loading
            ? "불러오는 중…"
            : isRepresentative
              ? "대표 콘텐츠 보기"
              : "관련 콘텐츠 보기"}
        </button>
        {error && (
          <p role="alert" className="max-w-md text-sm text-safety-red">
            {error}{" "}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {isRepresentative ? "원본 보기 ↗" : "게시물 보기 ↗"}
            </a>
          </p>
        )}
      </div>
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

  return (
    <div
      className={`relative max-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2 ${
        isShort ? "mx-auto aspect-[9/16] w-full max-w-[394px]" : "aspect-video w-full"
      }`}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
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
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background/85 shadow-lg transition-transform group-hover:scale-105">
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
