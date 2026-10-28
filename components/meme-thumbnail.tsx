"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { MemeCategory } from "@/lib/labels";

const OWNED_MEDIA_HOSTS = new Set(["catchmeme.com", "www.catchmeme.com"]);

function thumbnailSrcForBrowser(src: string | null): string | null {
  if (!src) return null;

  try {
    const url = new URL(src);
    const isOwnedMedia =
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      OWNED_MEDIA_HOSTS.has(url.hostname) &&
      url.pathname.startsWith("/api/media/");

    return isOwnedMedia ? `${url.pathname}${url.search}${url.hash}` : src;
  } catch {
    return src;
  }
}

/**
 * 카드 썸네일의 실패 경계를 한곳에서 처리한다.
 *
 * 외부 CDN 이미지가 만료되거나 네트워크가 끊겨도 브라우저의 깨진 이미지 아이콘을
 * 그대로 노출하지 않고, 본문을 반복하지 않는 차분한 제목 카드로 즉시 대체한다.
 * failedSrc를 URL과 함께 보관해 이후 다른 이미지 URL을 받으면 자동으로 다시 시도한다.
 */
export function MemeThumbnail({
  src,
  title,
  category,
  priority = false,
  variant = "card",
  fallback,
}: {
  src: string | null;
  title: string;
  fallbackCaption?: string;
  category: MemeCategory;
  originYear?: number | null;
  priority?: boolean;
  variant?: "card" | "compact";
  fallback?: ReactNode;
}) {
  const imageSrc = thumbnailSrcForBrowser(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const canRenderImage = Boolean(imageSrc && failedSrc !== imageSrc);
  const handleImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth === 0) {
        setFailedSrc(imageSrc);
      }
    },
    [imageSrc],
  );

  if (canRenderImage && imageSrc) {
    return (
      // 원격 도메인이 다양해 next/image remotePatterns 대신 img를 사용한다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={handleImageRef}
        src={imageSrc}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedSrc(imageSrc)}
        data-thumbnail-state="image"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    );
  }

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div
      aria-hidden
      data-thumbnail-state="fallback"
      className={`relative flex h-full w-full items-end ${
        variant === "compact" ? "p-3" : "p-4"
      }`}
      style={{
        background: `var(--cat-${category}-bg)`,
        color: `var(--cat-${category}-text)`,
      }}
    >
      <span
        className={`line-clamp-3 break-keep font-extrabold leading-snug ${
          variant === "compact" ? "text-base" : "text-lg"
        }`}
      >
        {title}
      </span>
    </div>
  );
}
