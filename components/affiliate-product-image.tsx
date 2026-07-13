"use client";

import { useCallback, useState } from "react";

export function AffiliateProductImage({
  imageUrl,
  productName,
}: {
  imageUrl: string | null;
  productName: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const failed = !imageUrl || failedImageUrl === imageUrl;
  const handleImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth === 0) {
        setFailedImageUrl(imageUrl);
      }
    },
    [imageUrl],
  );

  return (
    <div
      data-slot="affiliate-product-image"
      className="aspect-[4/3] overflow-hidden bg-accent-soft"
    >
      {!failed && imageUrl ? (
        // AdPick controls this URL, so preserve direct loading and privacy attributes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={handleImageRef}
          src={imageUrl}
          alt={productName}
          width={640}
          height={480}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid h-full place-items-center px-4 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-accent-text"
        >
          MemeCatch pick
        </div>
      )}
    </div>
  );
}
