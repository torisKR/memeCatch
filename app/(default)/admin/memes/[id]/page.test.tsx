import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: vi.fn() }));
vi.mock("@/components/admin/admin-meme-contents", () => ({ AdminMemeContents: () => <div /> }));
vi.mock("@/components/admin/meme-edit-form", () => ({ MemeEditForm: () => <div /> }));
vi.mock("@/components/admin/meme-status-controls", () => ({ MemeStatusControls: () => <div /> }));
vi.mock("@/components/admin/meme-origin-country-form", () => ({ MemeOriginCountryForm: () => <div /> }));
vi.mock("@/components/admin/catalog-provenance-panel", () => ({ CatalogProvenancePanel: () => <div /> }));
vi.mock("@/components/admin/meme-translation-review", () => ({ MemeTranslationReview: () => <div /> }));
vi.mock("@/components/studio/artifact-studio", () => ({ ArtifactStudio: () => <div /> }));
vi.mock("@/components/admin/badges", () => ({
  ModerationBadge: ({ status }: { status: string }) => <span>{status}</span>,
  OriginKindBadge: ({ originKind }: { originKind: string }) => <span>{originKind}</span>,
}));

import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import Page from "./page";

const MEME_ID = "a0000000-0000-4000-8000-00000000000f";

function thenableQuery(data: unknown, error: { message: string } | null = null) {
  const result = { data, error };
  const ready = Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(async () => result);
  chain.returns = vi.fn(async () => result);
  chain.then = ready.then.bind(ready);
  return chain;
}

describe("admin meme source recovery link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const meme = {
      id: MEME_ID,
      title: "오래된 영상 밈",
      short_id: "oldvideo",
      slug: "오래된-영상-밈",
      moderation_status: "approved",
      origin_kind: "external",
      usage_context: {},
      updated_at: "2026-10-18T00:00:00Z",
      aliases: [],
      safety_level: "yellow",
      lifecycle_status: "stable",
      category: "video",
      media_type: "video",
    };
    const byTable: Record<string, ReturnType<typeof thenableQuery>> = {
      memes: thenableQuery(meme),
      meme_contents: thenableQuery([]),
      meme_translations: thenableQuery([]),
      meme_sources: thenableQuery([]),
      meme_media: thenableQuery([]),
      meme_tags_map: thenableQuery([]),
      meme_market_profiles: thenableQuery([]),
    };
    vi.mocked(requireOperatorPage).mockResolvedValue({
      supabase: { from: vi.fn((table: string) => byTable[table]) },
    } as never);
  });

  it("opens the source workflow with this exact meme as the recovery target", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: MEME_ID }) }));

    expect(requireOperatorPage).toHaveBeenCalledWith(`/admin/memes/${MEME_ID}`);
    expect(html).toContain(`href="/admin/sources?memeId=${MEME_ID}"`);
    expect(html).toContain("영상 출처 추가");
  });
});
