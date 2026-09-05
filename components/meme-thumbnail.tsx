"use client";

import { useState } from "react";
import type { MemeCategory } from "@/lib/labels";

/**
 * 카드 썸네일의 실패 경계를 한곳에서 처리한다.
 *
 * 외부 CDN 이미지가 만료되거나 네트워크가 끊겨도 브라우저의 깨진 이미지 아이콘을
 * 그대로 노출하지 않고, 밈 제목을 담은 의도적인 타이포 카드로 즉시 대체한다.
 * failedSrc를 URL과 함께 보관해 이후 다른 이미지 URL을 받으면 자동으로 다시 시도한다.
 */
export function MemeThumbnail({
  src,
  title,
  fallbackCaption,
  category,
  originYear,
  priority = false,
  variant = "card",
}: {
  src: string | null;
  title: string;
  fallbackCaption?: string;
  category: MemeCategory;
  originYear?: number | null;
  priority?: boolean;
  variant?: "card" | "compact";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const canRenderImage = Boolean(src && failedSrc !== src);

  if (canRenderImage && src) {
    return (
      // 원격 도메인이 다양해 next/image remotePatterns 대신 img를 사용한다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedSrc(src)}
        data-thumbnail-state="image"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    );
  }

  return (
    <div
      aria-hidden
      data-thumbnail-state="fallback"
      className={`instrument-grid relative flex h-full w-full flex-col justify-end ${
        variant === "compact" ? "gap-1.5 p-3" : "gap-2 p-3.5"
      }`}
      style={{
        background: `var(--cat-${category}-bg)`,
        color: `var(--cat-${category}-text)`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`pointer-events-none absolute left-2 top-3 opacity-[0.12] ${
          variant === "compact" ? "size-12" : "size-16"
        }`}
      >
        <path d="M10.6 4.9C6.8 7.1 4.6 10.3 4.6 14.2c0 2.8 1.7 4.6 4 4.6 2 0 3.6-1.5 3.6-3.6 0-2-1.4-3.3-3.2-3.3-.3 0-.7 0-.9.1.4-2 2.1-4 4-5.2L10.6 4.9Zm8.9 0c-3.9 2.2-6 5.4-6 9.3 0 2.8 1.7 4.6 4 4.6 2 0 3.5-1.5 3.5-3.6 0-2-1.3-3.3-3.1-3.3-.3 0-.7 0-.9.1.4-2 2-4 4-5.2L19.5 4.9Z" />
      </svg>
      <span
        className={`relative line-clamp-3 font-extrabold leading-snug ${
          variant === "compact" ? "text-base" : "text-xl"
        }`}
      >
        {title}
      </span>
      {fallbackCaption && (
        <span className={`relative line-clamp-3 leading-snug opacity-80 ${
          variant === "compact" ? "text-xs" : "text-sm"
        }`}>
          {fallbackCaption}
        </span>
      )}
      {variant === "card" && originYear != null && (
        <span className="relative inline-flex items-center self-end rounded-full border border-current/30 px-2 py-0.5 text-[11px] font-bold tabular-nums tracking-tight">
          {originYear}
        </span>
      )}
    </div>
  );
}
