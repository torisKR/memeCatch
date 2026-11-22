import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  cached: vi.fn(), snapshot: vi.fn(), ledger: vi.fn(), search: vi.fn(), listLedger: vi.fn(), renderShare: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getReactionCounts: async () => ({}), getRelatedMemes: async () => [],
  searchMemes: mocks.search, getTrendingMemes: async () => [], getMemeByShortId: mocks.cached,
  MemeCatalogUnavailableError: class MemeCatalogUnavailableError extends Error {},
}));
vi.mock("@/lib/meme-delivery.server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/meme-delivery.server")>(),
  getReviewedMemeMediaSources: mocks.ledger,
}));
vi.mock("@/lib/db/server", () => ({ createStaticClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ in: () => ({ maybeSingle: mocks.snapshot }) }) }) }) }) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ in: mocks.listLedger }) }) }),
}));
vi.mock("@/lib/meme-market-passport.server", () => ({ getMemeMarketPassport: async () => null }));
vi.mock("@/lib/meme-contributions.server", () => ({ getMemeContributors: async () => [] }));
vi.mock("@/lib/index-gate.server", () => ({ loadDiscoveryIndex: async () => ({ ok: true, ids: new Set() }) }));
vi.mock("@/lib/meme-translations", () => ({ listIndexableLocalizedMemes: async () => [] }));
vi.mock("@/components/answer-card", () => ({ AnswerCard: () => null }));
vi.mock("@/components/safety-rationale", () => ({ SafetyRationale: () => null }));
vi.mock("@/components/usage-examples", () => ({ UsageExamples: () => null }));
vi.mock("@/components/meme-market-passport", () => ({ MemeMarketPassport: () => null }));
vi.mock("@/components/auth-invite", () => ({ AuthInvite: () => null }));
vi.mock("@/components/reaction-bar", () => ({ ReactionBar: () => null }));
vi.mock("@/components/comments", () => ({ Comments: () => null }));
vi.mock("@/components/export-button", () => ({ ExportButton: () => null }));
vi.mock("@/components/share-button", () => ({ ShareButton: () => null }));
vi.mock("@/app/(default)/memes/[key]/view-tracker", () => ({ ViewTracker: () => null }));
vi.mock("@/components/continue-stream", () => ({ ContinueStream: () => null }));
vi.mock("@/components/context-nav", () => ({ ContextNav: () => null }));
vi.mock("@/components/source-evidence", () => ({ SourceEvidence: () => null }));
vi.mock("@/components/trust-note", () => ({ TrustNote: () => null }));
vi.mock("@/components/doc-status-note", () => ({ DocStatusNote: () => null }));
vi.mock("@/components/meme-lifecycle-guide", () => ({ MemeLifecycleGuide: () => null }));
vi.mock("@/components/adsense-script", () => ({ AdsenseScript: () => null }));
vi.mock("@/app/(default)/search/search-input", () => ({ SearchInput: () => null }));
vi.mock("@/components/meme-reference-search", () => ({ MemeReferenceSearch: () => null }));
vi.mock("@/components/search-outcome-tracker", () => ({ SearchOutcomeTracker: () => null }));
vi.mock("@/components/tracked-block", () => ({ TrackedBlock: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/meme-share-card", () => ({
  renderMemeShareCard: vi.fn(),
  respondWithShareCard: mocks.renderShare,
}));

import KoreanDetailPage from "@/app/(default)/memes/[key]/page";
import KoreanSearchPage from "@/app/(default)/search/page";
import { loadKoreanShareCard } from "@/lib/meme-share-content";
import { GET as koreanOgRoute } from "@/app/(default)/memes/[key]/opengraph-image-k2cx9c/route";

const memeId = "00000000-0000-4000-8000-000000000001";
const video = (id: string, representative: boolean) => ({
  id: `row-${id}`, platform: "YouTube", content_id: id,
  url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: null,
  availability: "live", moderation_status: "approved", is_representative: representative,
  manual_video_verified: false, caption: null, type: "embed",
});
const source = (id: string, rights: string) => ({
  review_state: "approved", rights_basis: rights, platform: "youtube", external_id: id,
  canonical_url: `https://www.youtube.com/watch?v=${id}`, embeddable: true,
  public_status: "public", removed_at: null, last_checked_at: new Date().toISOString(),
});

describe("Korean routes with a stale cached document", () => {
  it.each([
    ["query_error", { data: null, error: { message: "offline" } }],
    ["invalid_response", { data: { id: memeId, meme_contents: [{ id: "broken" }], meme_sources: [] }, error: null }],
  ])("shows generated house art without stale media during %s and after recovery", async (_reason, snapshot) => {
    const stale = { ...video("abcdefghijk", true), meme_id: memeId, thumbnail_url: "https://stale.example.com/poster.jpg" };
    const fresh = { ...video("lmnopqrstuv", true), meme_id: memeId };
    mocks.cached.mockResolvedValue({
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "House title", summary: "House summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: "house_original", description: "House meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [stale],
      meme_sources: [{ meme_id: memeId, source_url: "https://stale.example.com/source" }], meme_tags_map: [],
    });
    mocks.snapshot.mockResolvedValue(snapshot);
    mocks.ledger.mockResolvedValue({ ok: true, sources: [source(fresh.content_id, "official_embed")] });
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
      expect(detail).toContain('alt="House title 자체 밈 카드"');
      const encoded = detail.match(/src="data:image\/svg\+xml;base64,([^"]+)"/)?.[1];
      expect(encoded).toBeTruthy();
      const art = Buffer.from(encoded!, "base64").toString("utf8");
      expect(art).toContain("House title");
      expect(art).toContain("House summary");
      expect(art).not.toContain("abcdefghijk");
      expect(art).not.toContain("stale.example.com");
      expect(detail).toContain('role="status"');
      expect(detail).not.toContain("abcdefghijk");
      expect(detail).not.toContain("stale.example.com");
      expect(detail).not.toContain("<iframe");
      expect((await loadKoreanShareCard("abc12345-test-meme"))?.photoUrl).toBeUndefined();

      mocks.snapshot.mockResolvedValue({ data: { id: memeId, meme_contents: [fresh], meme_sources: [] }, error: null });
      const recovered = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
      expect(recovered).toContain('alt="House title 자체 밈 카드"');
      expect(recovered).not.toContain("영상과 출처를 일시적으로 불러오지 못했어요.");
      expect(recovered).not.toContain("abcdefghijk");
      expect(recovered).not.toContain("stale.example.com");
    } finally {
      log.mockRestore();
    }
  });

  it("does not render cached house art when the snapshot confirms the document is not public", async () => {
    mocks.cached.mockResolvedValue({ id: memeId, short_id: "abc12345", slug: "test-meme", origin_kind: "house_original", meme_contents: [], meme_sources: [] });
    mocks.snapshot.mockResolvedValue({ data: null, error: null });
    await expect(KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it.each([
    ["query_error", { data: null, error: { message: "secret diagnostic" } }],
    ["invalid_response", { data: { id: memeId, meme_contents: [{ id: "broken" }], meme_sources: [] }, error: null }],
  ])("keeps cached text but hides stale media on %s", async (reason, snapshot) => {
    const stale = { ...video("abcdefghijk", true), meme_id: memeId };
    mocks.cached.mockResolvedValue({
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Cached title", summary: "Cached summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Cached meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [stale],
      meme_sources: [{ meme_id: memeId, source_url: "https://old.example" }], meme_tags_map: [],
    });
    mocks.snapshot.mockResolvedValue(snapshot);
    mocks.ledger.mockResolvedValue({ ok: true, sources: [] });
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
      const og = await loadKoreanShareCard("abc12345-test-meme");
      mocks.renderShare.mockResolvedValue(new Response("ok"));
      await koreanOgRoute(new Request("http://localhost/memes/abc12345-test-meme/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "abc12345-test-meme" }) });
      expect(detail).toContain("Cached title");
      expect(detail).toContain("Cached meaning");
      expect(detail).toContain('role="status"');
      expect(detail).toContain("영상과 출처를 일시적으로 불러오지 못했어요.");
      expect(detail).not.toContain("abcdefghijk");
      expect(detail).not.toContain("old.example");
      expect(og?.title).toBe("Cached title");
      expect(og?.photoUrl).toBeUndefined();
      expect(mocks.renderShare).toHaveBeenLastCalledWith("ko", og);
      expect(log).toHaveBeenCalledWith(`[meme-media-snapshot] ${reason}`);
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret diagnostic");
    } finally {
      log.mockRestore();
    }
  });

  it("blocks detail and OG when the public snapshot confirms removal", async () => {
    mocks.cached.mockResolvedValue({ id: memeId, short_id: "bjk2021k", slug: "bun-jo-ka", title: "Cached title", meme_contents: [], meme_sources: [] });
    mocks.snapshot.mockResolvedValue({ data: null, error: null });
    await expect(KoreanDetailPage({ params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }) })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(await loadKoreanShareCard("bjk2021k-bun-jo-ka")).toBeNull();
    mocks.renderShare.mockResolvedValue(new Response("missing", { status: 404 }));
    const response = await koreanOgRoute(new Request("http://localhost/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }) });
    expect(response.status).toBe(404);
    expect(mocks.renderShare).toHaveBeenLastCalledWith("ko", null);
  });

  it("uses the current public media snapshot in search, detail and OG", async () => {
    const old = { ...video("abcdefghijk", true), meme_id: memeId };
    const fresh = { ...video("lmnopqrstuv", true), meme_id: memeId };
    const cached = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [old], meme_sources: [], meme_tags_map: [],
    };
    const current = { ...cached, meme_contents: [fresh] };
    const sources = [source(fresh.content_id, "official_embed")];
    mocks.cached.mockResolvedValue(cached);
    mocks.snapshot.mockResolvedValue({ data: { id: memeId, meme_contents: [fresh], meme_sources: [] }, error: null });
    mocks.search.mockResolvedValue([current]);
    mocks.ledger.mockResolvedValue({ ok: true, sources });
    mocks.listLedger.mockResolvedValue({ data: sources.map((item) => ({ meme_id: memeId, review_state: item.review_state, rights_basis: item.rights_basis, media_sources: item })), error: null });
    mocks.renderShare.mockResolvedValue(new Response("ok"));
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    const response = await koreanOgRoute(new Request("http://localhost/memes/abc12345-test-meme/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "abc12345-test-meme" }) });
    expect(response.status).toBe(200);
    expect(search).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(detail).toContain("youtube-nocookie.com/embed/lmnopqrstuv");
    expect(detail).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(mocks.renderShare).toHaveBeenCalledWith("ko", og);
  });

  it("shows approved related examples without a representative across fresh routes", async () => {
    const first = { ...video("abcdefghijk", false), meme_id: memeId };
    const second = { ...video("lmnopqrstuv", false), meme_id: memeId };
    const stale = { ...video("zyxwvutsrqp", true), meme_id: memeId };
    const blocked = { ...video("AAAAAAAAAAA", false), meme_id: memeId };
    const cached = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [stale], meme_sources: [], meme_tags_map: [],
    };
    const sources = [source(first.content_id, "official_embed"), source(second.content_id, "official_embed"), source(blocked.content_id, "blocked")];
    mocks.cached.mockResolvedValue(cached);
    mocks.snapshot.mockResolvedValue({ data: { id: memeId, meme_contents: [second, blocked, first], meme_sources: [] }, error: null });
    mocks.search.mockResolvedValue([{ ...cached, meme_contents: [first, second, blocked] }]);
    mocks.ledger.mockResolvedValue({ ok: true, sources });
    mocks.listLedger.mockResolvedValue({ data: sources.map((item) => ({ meme_id: memeId, review_state: item.review_state, rights_basis: item.rights_basis, media_sources: item })), error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).not.toContain("i.ytimg.com/vi/abcdefghijk");
    expect(search).not.toContain("i.ytimg.com/vi/lmnopqrstuv");
    expect(detail).not.toContain('aria-label="대표 콘텐츠"');
    expect(detail).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(detail).not.toContain("youtube-nocookie.com/embed/zyxwvutsrqp");
    expect(detail).not.toContain("i.ytimg.com/vi/AAAAAAAAAAA");
    expect(og?.photoUrl).toBeUndefined();
  });
});
