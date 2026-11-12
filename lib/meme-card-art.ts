import type { Locale } from "@/lib/i18n";

/** Direction B poster art: a 1200×900 original, with width candidates for srcset. */
export const MEME_CARD_ART_WIDTHS = [600, 900, 1200] as const;
export const MEME_CARD_ART_WIDTH = 1200;
export const MEME_CARD_ART_HEIGHT = 900;

const OWNED_ART_HOSTS = new Set(["catchmeme.com", "www.catchmeme.com"]);
const OWNED_ART_PATH = /^\/api\/media\/meme-card-art\/[A-Za-z0-9._~-]+$/;

export type MemeCardArtSource = {
  /** 1200px original. Width variants differ only by `?w=`. */
  src: string;
  srcSet: string;
  width: typeof MEME_CARD_ART_WIDTH;
  height: typeof MEME_CARD_ART_HEIGHT;
};

type ArtContent = {
  thumbnail_url?: string | null;
  is_representative?: boolean | null;
};

export type MemeCardArtCarrier = {
  card_art_url?: string | null;
  meme_contents?: readonly ArtContent[] | null;
};

/**
 * Owned 4:3 card art lives at `/api/media/meme-card-art/{file}`.
 * YouTube stills, rehosted social thumbs, and data URLs are not card art.
 * Adding a file later only changes this path; the card chrome stays put.
 */
export function ownedMemeCardArtPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;

  let pathname = "";
  if (trimmed.startsWith("/")) {
    pathname = trimmed.split(/[?#]/)[0] ?? "";
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!OWNED_ART_HOSTS.has(url.hostname.toLowerCase())) return null;
    pathname = url.pathname;
  }

  if (!pathname || pathname.includes("..") || !OWNED_ART_PATH.test(pathname)) return null;
  return pathname;
}

export function memeCardArtSources(pathname: string): MemeCardArtSource {
  const srcSet = MEME_CARD_ART_WIDTHS.map((width) => `${pathname}?w=${width} ${width}w`).join(", ");
  return {
    src: `${pathname}?w=${MEME_CARD_ART_WIDTH}`,
    srcSet,
    width: MEME_CARD_ART_WIDTH,
    height: MEME_CARD_ART_HEIGHT,
  };
}

export function memeCardArtFromMeme(meme: MemeCardArtCarrier): MemeCardArtSource | null {
  const explicit = ownedMemeCardArtPath(meme.card_art_url);
  if (explicit) return memeCardArtSources(explicit);

  const contents = meme.meme_contents ?? [];
  const ordered = [
    ...contents.filter((content) => content.is_representative && content.thumbnail_url),
    ...contents.filter((content) => content.thumbnail_url && !content.is_representative),
  ];
  for (const content of ordered) {
    const path = ownedMemeCardArtPath(content.thumbnail_url);
    if (path) return memeCardArtSources(path);
  }
  return null;
}

export function memeCardArtAlt(title: string, locale: Locale): string {
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
    case "th":
    case "vi":
    case "mn":
    case "id":
    case "ar":
    case "ru":
    case "es":
    case "de":
    case "fr":
    case "it":
    case "pt":
    case "tr":
    case "ms":
    case "hi":
      return `${title} symbol illustration`;
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}
