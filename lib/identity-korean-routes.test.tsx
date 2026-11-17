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
  it.each([
    ["YouTube watch/shorts", "youtube", "abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk"],
    ["YouTube shorts/watch", "youtube_shorts", "abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk"],
    ["TikTok alias", "tiktok", "1234567890123456789", "https://www.tiktok.com/@old/video/1234567890123456789", "https://www.tiktok.com/@new/video/1234567890123456789"],
    ["Instagram verified post", "instagram", "Post123", "https://www.instagram.com/p/Post123/", "https://www.instagram.com/p/Post123/"],
    ["Instagram reel", "instagram", "Reel123", "https://www.instagram.com/reel/Reel123/", "https://www.instagram.com/reel/Reel123/"],
  ].flatMap(([label, platform, id, ledgerUrl, contentUrl]) => [false, true].map((embeddable) => ({ label, platform, id, ledgerUrl, contentUrl, embeddable }))))("keeps $label link-only with embeddable=$embeddable out of search, detail, OG and related videos", async ({ platform, id, ledgerUrl, contentUrl, embeddable }) => {
    const selected = { ...video(id, true), platform, url: contentUrl, manual_video_verified: true, thumbnail_url: "/link-only-poster.jpg" };
    const related = video("lmnopqrstuv", false);
    const entry = { ...source(id, "link_only"), platform, canonical_url: ledgerUrl, embeddable, last_checked_at: "2020-01-01T00:00:00.000Z", public_status: platform === "tiktok" || platform === "instagram" ? null : "public" };
    const otherSource = source(related.content_id, "official_embed");
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [selected, related], meme_sources: [], meme_tags_map: [],
    };
    const sources = [entry, otherSource];
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources });
    mocks.listLedger.mockResolvedValue({ data: sources.map((item) => ({ meme_id: memeId, review_state: item.review_state, rights_basis: item.rights_basis, media_sources: item })), error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    mocks.renderShare.mockResolvedValue(new Response("ok"));
    await koreanOgRoute(new Request("http://localhost/memes/abc12345-test-meme/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "abc12345-test-meme" }) });
    expect(search).not.toContain(`i.ytimg.com/vi/${id}`);
    expect(search).not.toContain("TikTok 영상 미리보기");
    expect(search).not.toContain("link-only-poster.jpg");
    expect(detail).not.toContain(`youtube-nocookie.com/embed/${id}`);
    expect(detail).not.toContain(`tiktok.com/player/v1/${id}`);
    expect(detail).not.toContain(`i.ytimg.com/vi/${id}`);
    expect(detail).not.toContain("link-only-poster.jpg");
    expect(detail).toContain(`href="${contentUrl}"`);
    expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(og?.photoUrl).toBeUndefined();
    expect(mocks.renderShare).toHaveBeenLastCalledWith("ko", og);
  });
  it.each([
    ["youtube", "abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk"],
    ["tiktok", "1234567890123456789", "https://www.tiktok.com/@old/video/1234567890123456789", "https://www.tiktok.com/@new/video/1234567890123456789"],
    ["instagram", "Post123", "https://www.instagram.com/p/Post123/", "https://www.instagram.com/p/Post123/"],
  ].flatMap(([platform, id, ledgerUrl, contentUrl]) => [false, true].map((embeddable) => ({ platform, id, ledgerUrl, contentUrl, embeddable }))))("omits $platform link-only related media with embeddable=$embeddable while retaining an approved representative", async ({ platform, id, ledgerUrl, contentUrl, embeddable }) => {
    const selected = video("lmnopqrstuv", true);
    const related = { ...video(id, false), platform, url: contentUrl, manual_video_verified: true, thumbnail_url: "/link-only-poster.jpg" };
    const sources = [source(selected.content_id, "official_embed"), { ...source(id, "link_only"), platform, canonical_url: ledgerUrl, embeddable, public_status: platform === "youtube" ? "public" : null }];
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [selected, related], meme_sources: [], meme_tags_map: [],
    };
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources });
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    expect(detail).toContain("youtube-nocookie.com/embed/lmnopqrstuv");
    expect(detail).not.toContain(`youtube-nocookie.com/embed/${id}`);
    expect(detail).not.toContain(`tiktok.com/player/v1/${id}`);
    expect(detail).not.toContain("link-only-poster.jpg");
    expect(detail).toContain(`href="${contentUrl}"`);
  });
  it.each([
    ["youtube", "abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk"],
    ["tiktok", "1234567890123456789", "https://www.tiktok.com/@old/video/1234567890123456789"],
    ["instagram", "Post123", "https://www.instagram.com/p/Post123/"],
  ].flatMap(([platform, id, url]) => [false, true].flatMap((embeddable) => [
    { name: "private", sourceOverride: { public_status: "private" }, availability: "live" },
    { name: "unlisted", sourceOverride: { public_status: "unlisted" }, availability: "live" },
    { name: "removed", sourceOverride: { removed_at: "2026-01-01T00:00:00Z" }, availability: "live" },
    { name: "dead", sourceOverride: {}, availability: "dead" },
    { name: "region_blocked", sourceOverride: {}, availability: "region_blocked" },
  ].map((restriction) => ({ platform, id, url, embeddable, ...restriction })))))
  ("blocks $platform $name link-only media and links with embeddable=$embeddable in routes", async ({ platform, id, url, embeddable, sourceOverride, availability }) => {
    const selected = { ...video(id, true), platform, url, availability, manual_video_verified: true, thumbnail_url: "/link-only-poster.jpg" };
    const entry = { ...source(id, "link_only"), platform, canonical_url: url, embeddable, public_status: platform === "youtube" ? "public" : null, ...sourceOverride };
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [selected], meme_sources: [{ source_url: url, platform }], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources: [entry] });
    mocks.listLedger.mockResolvedValue({ data: [{ meme_id: memeId, review_state: entry.review_state, rights_basis: entry.rights_basis, media_sources: entry }], error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).not.toContain("link-only-poster.jpg");
    expect(search).not.toContain(`i.ytimg.com/vi/${id}`);
    expect(detail).not.toContain(`href="${url}"`);
    expect(detail).not.toContain("link-only-poster.jpg");
    expect(detail).not.toContain(`youtube-nocookie.com/embed/${id}`);
    expect(og?.photoUrl).toBeUndefined();
  });
  it.each([false, true])("keeps an unverified Instagram post link-only without a player or poster, embeddable=%s", async (embeddable) => {
    const id = "Post123";
    const url = `https://www.instagram.com/p/${id}/`;
    const selected = { ...video(id, true), platform: "instagram", url, manual_video_verified: false, thumbnail_url: "/link-only-poster.jpg" };
    const entry = { ...source(id, "link_only"), platform: "instagram", canonical_url: url, embeddable, public_status: null };
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [selected], meme_sources: [], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources: [entry] });
    mocks.listLedger.mockResolvedValue({ data: [{ meme_id: memeId, review_state: entry.review_state, rights_basis: entry.rights_basis, media_sources: entry }], error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(detail).toContain(`href="${url}"`);
    expect(detail).not.toContain("<iframe");
    expect(search).not.toContain("link-only-poster.jpg");
    expect(detail).not.toContain("link-only-poster.jpg");
    expect(og?.photoUrl).toBeUndefined();
  });
  it.each([
    { rights_basis: "blocked", canonical_url: "http://www.youtube.com/watch?v=abcdefghijk" },
    { rights_basis: "blocked", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
    { rights_basis: "invalid-rights" },
    { public_status: "invalid-status" },
  ])("suppresses corrupted or restrictive source in search, detail and OG", async (override) => {
    const selected = video("abcdefghijk", true);
    const entry = { ...source(selected.content_id, "official_embed"), ...override };
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [selected], meme_sources: [], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources: [entry] });
    mocks.listLedger.mockResolvedValue({ data: [{ meme_id: memeId, review_state: entry.review_state, rights_basis: entry.rights_basis, media_sources: entry }], error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).not.toContain("i.ytimg.com/vi/abcdefghijk");
    expect(detail).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(og?.photoUrl).toBeUndefined();
  });
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
    mocks.listLedger.mockResolvedValue({ data: sources.map((item) => ({ meme_id: memeId, review_state: item.review_state, rights_basis: item.rights_basis, media_sources: item })), error: null });
    mocks.renderShare.mockReset();
    mocks.renderShare.mockResolvedValue(new Response("ok"));
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    const response = await koreanOgRoute(new Request("http://localhost/memes/abc12345-test-meme/opengraph-image-k2cx9c"), { params: Promise.resolve({ key: "abc12345-test-meme" }) });
    expect(response.status).toBe(200);
    expect(mocks.renderShare).toHaveBeenCalledWith("ko", og);
    if (blocked) {
      expect(search).not.toContain("i.ytimg.com/vi/abcdefghijk");
      expect(search).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
      expect(detail).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
      expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
      expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    } else {
      expect(search).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
      expect(detail).toContain("youtube-nocookie.com/embed/abcdefghijk?rel=0");
      expect(og?.photoUrl).toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    }
  });

  it("withholds ambiguous representative previews while keeping approved related videos", async () => {
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
    mocks.listLedger.mockResolvedValue({ data: [first, second].map((item) => ({ meme_id: memeId, review_state: "approved", rights_basis: "official_embed", media_sources: source(item.content_id, "official_embed") })), error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).not.toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(search).not.toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(detail).not.toContain('aria-label="대표 콘텐츠"');
    expect(detail).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(detail).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
    expect(detail).toContain("관련 영상");
    expect(og?.photoUrl).toBeUndefined();
  });

  it("keeps an existing manually verified Instagram preview with an empty successful ledger", async () => {
    const post = { ...video("Post123", true), platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: true };
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", lifecycle_status: "active", moderation_status: "approved",
      origin_year: null, origin_kind: null, description: "Meaning", origin: null, usage_note: null,
      caution: null, usage_context: null, usage_examples: [], meme_contents: [post], meme_sources: [], meme_tags_map: [],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.document.mockResolvedValue({ kind: "database", meme, requestedShortId: meme.short_id, targetShortId: meme.short_id });
    mocks.ledger.mockResolvedValue({ ok: true, sources: [] });
    mocks.listLedger.mockResolvedValue({ data: [], error: null });
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    const detail = renderToStaticMarkup(await KoreanDetailPage({ params: Promise.resolve({ key: "abc12345-test-meme" }) }));
    const og = await loadKoreanShareCard("abc12345-test-meme");
    expect(search).toContain("Instagram 영상 미리보기");
    expect(detail).toContain("https://www.instagram.com/p/Post123/embed/captioned/");
    expect(og?.photoUrl).toBeUndefined();
  });

  it.each([
    { data: null, error: { message: "unavailable" } },
    { data: [{ meme_id: memeId, review_state: "approved" }], error: null },
  ])("keeps the search card but hides its preview when the batch ledger fails", async (response) => {
    const meme = {
      id: memeId, short_id: "abc12345", slug: "test-meme", title: "Test meme", summary: "Test summary",
      category: "phrase", safety_level: "green", origin_year: null, meme_contents: [video("abcdefghijk", true)],
    };
    mocks.search.mockResolvedValue([meme]);
    mocks.listLedger.mockResolvedValue(response);
    const search = renderToStaticMarkup(await KoreanSearchPage({ searchParams: Promise.resolve({ q: "test" }) }));
    expect(search).toContain("Test meme");
    expect(search).not.toContain("i.ytimg.com/vi/abcdefghijk");
  });
});
