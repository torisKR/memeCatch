import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Metadata } from "next";
import { metadata as communityMetadata } from "@/app/(default)/community/page";
import { metadata as communityNewMetadata } from "@/app/(default)/community/new/page";
import { metadata as contactMetadata } from "@/app/(default)/contact/page";
import { metadata as globalMetadata } from "@/app/(default)/global/page";
import { metadata as koreanLayoutMetadata } from "@/app/(default)/layout";
import { metadata as memeCardsMetadata } from "@/app/(default)/meme-cards/page";
import { metadata as originalsMetadata } from "@/app/(default)/originals/page";
import { metadata as privacyMetadata } from "@/app/(default)/privacy/page";
import { metadata as studioMetadata } from "@/app/(default)/studio/page";
import { metadata as supportMetadata } from "@/app/(default)/support/page";
import { metadata as termsMetadata } from "@/app/(default)/terms/page";
import { KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES } from "@/lib/i18n-routing";

const EXPECTED = ["en_US", "ja_JP", "zh_CN", "zh_TW"] as const;

function alternateLocales(metadata: Metadata): string[] | undefined {
  const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph)
    ? metadata.openGraph
    : undefined;
  const value = openGraph?.alternateLocale;
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

describe("Korean pages that inherit the layout card keep its alternate locales", () => {
  it("uses one shared list of the four SEO locales", () => {
    expect(KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES).toEqual([...EXPECTED]);
    expect(alternateLocales(koreanLayoutMetadata)).toEqual([...EXPECTED]);
  });

  it.each([
    ["/global", globalMetadata],
    ["/meme-cards", memeCardsMetadata],
    ["/originals", originalsMetadata],
    ["/privacy", privacyMetadata],
    ["/studio", studioMetadata],
    ["/support", supportMetadata],
    ["/terms", termsMetadata],
    ["/community/new", communityNewMetadata],
  ] as const)("%s has exactly those four alternate locales", (_path, metadata) => {
    expect(alternateLocales(metadata)).toEqual([...EXPECTED]);
    expect(alternateLocales(metadata)).toEqual(alternateLocales(koreanLayoutMetadata));
  });

  it("leaves pages that already replaced openGraph on main without the layout list", () => {
    expect(alternateLocales(communityMetadata)).toBeUndefined();
    expect(alternateLocales(contactMetadata)).toBeUndefined();
  });
});
