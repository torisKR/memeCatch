"use client";

import { useState } from "react";
import type { MemeContentRow } from "@/lib/queries";

/**
 * 대표 콘텐츠 임베드.
 * - YouTube + content_id + availability≠dead → lite embed(클릭 시 iframe, sandbox, 지연 로드)
 * - 그 외 / 원본 소실 → 폴백 카드 "원본은 사라졌지만…" + 출처 링크
 */
export function MemeEmbed({
  content,
  fallbackSourceUrl,
  title,
}: {
  content: Pick<
    MemeContentRow,
    "platform" | "content_id" | "url" | "thumbnail_url" | "availability" | "caption"
  > | null;
  fallbackSourceUrl?: string | null;
  title: string;
}) {
  const isYouTube =
    content != null &&
    content.platform?.toLowerCase() === "youtube" &&
    !!content.content_id &&
    content.availability !== "dead";

  if (isYouTube) {
    return (
      <figure>
        <LiteYouTube
          videoId={content.content_id as string}
          title={title}
          thumbnailUrl={content.thumbnail_url}
        />
        {content.caption && (
          <figcaption className="mt-2 text-sm text-muted">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  const sourceUrl = content?.url ?? fallbackSourceUrl ?? null;

  // 출처가 있으면 "확인 가능" 톤, 정말 없을 때만 "소실" 톤 — 오해 방지
  if (sourceUrl) {
    const isNamu = sourceUrl.includes("namu.wiki");
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <p className="text-base font-semibold">
          원본 콘텐츠는 출처에서 볼 수 있어요.
        </p>
        <p className="mt-1 text-base text-muted">
          저작권 보호를 위해 원본을 복제하지 않고 링크로 연결해요.
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold transition-colors hover:border-accent hover:text-accent"
        >
          {isNamu ? "나무위키에서 원본 맥락 보기" : "출처에서 원본 보기"}
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

function LiteYouTube({
  videoId,
  title,
  thumbnailUrl,
}: {
  videoId: string;
  title: string;
  thumbnailUrl?: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const thumb =
    thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video max-h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-surface-2">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
          title={`${title} — 대표 영상`}
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
          aria-label={`${title} 영상 재생`}
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
