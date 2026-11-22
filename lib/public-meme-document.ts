import { cache } from "react";
import { memeSeoDescription, memeSeoTitle } from "@/lib/meme-seo-copy";
import type { Metadata } from "next";
import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";
import { curatedDepthInput, findCuratedCoreMeme, type CuratedMeme } from "@/lib/curated-memes";
import { koreanDetailRobots } from "@/lib/thin-meme";
import { memePathFrom, shortIdFromParam } from "@/lib/labels";
import { curatedShareVersion, koreanMemeShareImage } from "@/lib/meme-share-image";
import { classifyPublicMemeLookup, type PublicMemeLookup } from "@/lib/public-meme-lookup";
import { getKoreanMediaSnapshot } from "@/lib/korean-media-snapshot.server";
import {
  getMemeByShortId,
  MemeCatalogUnavailableError,
  type MemeDetail,
} from "@/lib/queries";

type RouteIds = {
  requestedShortId: string;
  targetShortId: string;
};

export type KoreanMemeDocument = PublicMemeLookup<MemeDetail, CuratedMeme> & RouteIds & { mediaUnavailable?: boolean };

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
    if (row) {
      const media = await getKoreanMediaSnapshot(row.id);
      if (media.status === "not_public") return withRoute({ kind: "missing" }, requestedShortId, targetShortId);
      if (media.status === "unavailable") {
        console.warn(`[meme-media-snapshot] ${media.reason}`);
        return { ...withRoute({ kind: "database", meme: { ...row, meme_contents: [], meme_sources: [] } }, requestedShortId, targetShortId), mediaUnavailable: true };
      }
      return withRoute({ kind: "database", meme: { ...row, ...media.media } }, requestedShortId, targetShortId);
    }
    const lookup = classifyPublicMemeLookup<MemeDetail, CuratedMeme>({ row, curated, catalogUnavailable: false });
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
  const title = memeSeoTitle("ko", meme.title);
  const description = memeSeoDescription("ko", {
    title: meme.title,
    summary: meme.summary,
    originYear: meme.origin_year,
    safetyLevel: meme.safety_level,
    usageExampleCount: meme.usage_examples.length,
    hasOrigin: Boolean(meme.origin.trim()),
  });
  const robots = koreanDetailRobots(curatedDepthInput(meme));
  const image = koreanMemeShareImage({
    shortId: meme.short_id,
    slug: meme.slug,
    alt: meme.title,
    version: curatedShareVersion(meme),
  });
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
