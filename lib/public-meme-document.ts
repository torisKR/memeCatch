import { cache } from "react";
import type { Metadata } from "next";
import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";
import { findCuratedCoreMeme, type CuratedMeme } from "@/lib/curated-memes";
import { memePathFrom, shortIdFromParam } from "@/lib/labels";
import { curatedShareVersion, koreanMemeShareImage } from "@/lib/meme-share-image";
import { classifyPublicMemeLookup, type PublicMemeLookup } from "@/lib/public-meme-lookup";
import {
  getMemeByShortId,
  MemeCatalogUnavailableError,
  type MemeDetail,
} from "@/lib/queries";

type RouteIds = {
  requestedShortId: string;
  targetShortId: string;
};

export type KoreanMemeDocument = PublicMemeLookup<MemeDetail, CuratedMeme> & RouteIds;

function withRoute(
  lookup: PublicMemeLookup<MemeDetail, CuratedMeme>,
  requestedShortId: string,
  targetShortId: string,
): KoreanMemeDocument {
  switch (lookup.kind) {
    case "database":
      return { kind: "database", meme: lookup.meme, requestedShortId, targetShortId };
    case "curated":
      return { kind: "curated", meme: lookup.meme, requestedShortId, targetShortId };
    case "unavailable":
      return { kind: "unavailable", requestedShortId, targetShortId };
    case "missing":
      return { kind: "missing", requestedShortId, targetShortId };
    default: {
      const unreachable: never = lookup;
      return unreachable;
    }
  }
}

export const resolveKoreanMemeDocument = cache(async function resolveKoreanMemeDocument(
  key: string,
): Promise<KoreanMemeDocument> {
  const requestedShortId = shortIdFromParam(key);
  const targetShortId = CANONICAL_MEME_ALIAS_MAP[requestedShortId] ?? requestedShortId;
  const curated = findCuratedCoreMeme(targetShortId);
  try {
    const row = await getMemeByShortId(targetShortId);
    const lookup = classifyPublicMemeLookup({ row, curated, catalogUnavailable: false });
    return withRoute(lookup, requestedShortId, targetShortId);
  } catch (error) {
    if (!(error instanceof MemeCatalogUnavailableError)) throw error;
    return withRoute(
      classifyPublicMemeLookup<MemeDetail, CuratedMeme>({
        row: null,
        curated,
        catalogUnavailable: true,
      }),
      requestedShortId,
      targetShortId,
    );
  }
});

export function unavailableMemeMetadata(): Metadata {
  return {
    title: "밈을 잠시 불러오지 못했어요",
    robots: { index: false, follow: true },
  };
}

export function curatedMemeMetadata(meme: CuratedMeme): Metadata {
  const path = memePathFrom(meme.short_id, meme.slug);
  const title = `${meme.title} 뜻`;
  const image = koreanMemeShareImage({
    shortId: meme.short_id,
    slug: meme.slug,
    alt: meme.title,
    version: curatedShareVersion(meme),
  });
  return {
    title,
    description: meme.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title,
      description: meme.summary,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: meme.summary,
      images: [image],
    },
  };
}
