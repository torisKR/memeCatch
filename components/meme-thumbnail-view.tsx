import type { ReactNode, Ref } from "react";
import type { MemeCategory } from "@/lib/labels";
import type { MemeCountryLocale } from "@/lib/meme-country";

/** Localized name for the card image. Matches the shared card's alt copy. */
export function memeThumbnailAlt(title: string, locale: MemeCountryLocale): string {
  switch (locale) {
    case "ko":
      return `${title} 상징 일러스트`;
    case "ja":
      return `${title}の象徴イラスト`;
    case "zh":
      return `${title}象征插画`;
    case "zh-tw":
      return `${title}象徵插畫`;
    case "en":
      return `${title} symbol illustration`;
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}

const OWNED_MEDIA_HOSTS = new Set(["catchmeme.com", "www.catchmeme.com"]);

/** Owned media is same-origin. Other URLs stay absolute so the browser requests them directly. */
export function memeThumbnailSrc(src: string | null): string | null {
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

/** Illustration used when a 410 card has no catalog photo. It is an image, not a CSS background. */
export function symbolicCardArt(title: string): string {
  const label = [...title].map((char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#16324f"/><text x="28" y="248" fill="#ffffff" font-size="28" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Static thumbnail frame. The client wrapper adds the broken-image fallback;
 * the 410 document renders this directly because it cannot call client hooks.
 */
export function MemeThumbnailView({
  src,
  title,
  fallbackCaption,
  category,
  originYear,
  priority = false,
  variant = "card",
  fallback,
  alt = "",
  imageRef,
  onError,
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
  imageRef?: Ref<HTMLImageElement>;
  onError?: () => void;
}) {
  if (src) {
    return (
      // 원격 도메인이 다양해 next/image remotePatterns 대신 img를 사용한다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={onError}
        data-thumbnail-state="image"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    );
  }

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
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
        <span
          className={`relative line-clamp-3 leading-snug ${
            variant === "compact" ? "text-xs" : "text-sm"
          }`}
        >
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
