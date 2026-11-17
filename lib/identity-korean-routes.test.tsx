import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  document: vi.fn(), ledger: vi.fn(), search: vi.fn(), listLedger: vi.fn(), renderShare: vi.fn(),
}));
vi.mock("@/lib/public-meme-document", () => ({
  resolveKoreanMemeDocument: mocks.document,
  curatedMemeMetadata: vi.fn(), unavailableMemeMetadata: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getReactionCounts: async () => ({}), getRelatedMemes: async () => [],
  searchMemes: mocks.search, getTrendingMemes: async () => [],
}));
vi.mock("@/lib/meme-delivery.server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/meme-delivery.server")>(),
  getReviewedMemeMediaSources: mocks.ledger,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ in: mocks.listLedger }) }) }),
}));
vi.mock("@/lib/meme-market-passport.server", () => ({ getMemeMarketPassport: async () => null }));
vi.mock("@/lib/index-gate.server", () => ({ loadDiscoveryIndex: async () => ({ ok: true, ids: new Set() }) }));
vi.mock("@/lib/meme-translations", () => ({ listIndexableLocalizedMemes: async () => [] }));
vi.mock("@/components/answer-card", () => ({ AnswerCard: () => null }));
vi.mock("@/components/safety-rationale", () => ({ SafetyRationale: () => null }));
vi.mock("@/components/usage-examples", () => ({ UsageExamples: () => null }));
vi.mock("@/components/meme-market-passport", () => ({ MemeMarketPassport: () => null }));
vi.mock("@/components/auth-invite", () => ({ AuthInvite: () => null }));
vi.mock("@/components/related-video-list", () => ({ RelatedVideoList: () => null }));
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

describe("existing Korean search, detail and OG identity", () => {
  it.each([false, true])("characterizes approved and blocked representative: blocked=%s", async (blocked) => {
    const contents = [video("abcdefghijk", true), ...(blocked ? [video("lmnopqrstuv", false)] : [])];
    const sources = [source("abcdefghijk", blocked ? "blocked" : "official_embed"), ...(blocked ? [source("lmnopqrstuv", "official_embed")] : [])];
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: contents, meme_sources: [], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources });
    mocks.renderShare.mockReset();
    mocks.renderShare.mockResolvedValue(new Response("ok"));
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    const response = await koreanOgRoute(new Request("http://localhost/memes/abc12345-test-meme/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "abc12345-test-meme" }) });
    expect(response.status).toBe(200);
    expect(mocks.renderShare).toHaveBeenCalledWith("ko", og);
    expect(search).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    if (blocked) {
      // Existing raw search card and policy-filtered detail differ; this is unresolved.
      expect(detail).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
      expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
      expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    } else {
      expect(detail).toContain("youtube-nocookie.com/embed/abcdefghijk?rel=0");
      expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    }
  });

  it("reproduces different identities when unordered nonrepresentatives are returned in opposite orders", async () => {
    const first = video("abcdefghijk", false);
    const second = video("lmnopqrstuv", false);
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [first, second], meme_sources: [], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme: { ...meme, meme_contents: [second, first] }, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources: [source(first.content_id, "official_embed"), source(second.content_id, "official_embed")] });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
  });
});
