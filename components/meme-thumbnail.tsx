"use client";

import { useCallback, useState, type ReactNode } from "react";
import { memeThumbnailSrc, MemeThumbnailView } from "@/components/meme-thumbnail-view";
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
  fallback,
  alt = "",
}: {
  src: string | null;
  title: string;
  fallbackCaption?: string;
  category: MemeCategory;
  originYear?: number | null;
  priority?: boolean;
  variant?: "card" | "compact";
  fallback?: ReactNode;
  alt?: string;
}) {
  const imageSrc = memeThumbnailSrc(src);
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
      <MemeThumbnailView
        src={imageSrc}
        title={title}
        fallbackCaption={fallbackCaption}
        category={category}
        originYear={originYear}
        priority={priority}
        variant={variant}
        alt={alt}
        imageRef={handleImageRef}
        onError={() => setFailedSrc(imageSrc)}
      />
    );
  }

  return (
    <MemeThumbnailView
      src={null}
      title={title}
      fallbackCaption={fallbackCaption}
      category={category}
      originYear={originYear}
      variant={variant}
      alt={alt}
      fallback={fallback}
    />
  );
}
