import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getLocalizedMemeByShortId: vi.fn(),
  getLocalizedSearchMemesResult: vi.fn(async () => ({ items: new Map(), status: "active" })),
  listIndexableLocalizedMemes: vi.fn(async () => []),
  getRelatedMemes: vi.fn(async () => []),
  getReviewedMemeMediaSources: vi.fn(),
}));
vi.mock("@/lib/meme-translations", () => ({
  ...mocks,
  isIndexableLocalizedMeme: () => true,
}));
vi.mock("@/lib/queries", () => ({
  getRelatedMemes: mocks.getRelatedMemes,
  MemeCatalogUnavailableError: class MemeCatalogUnavailableError extends Error {},
}));
vi.mock("@/lib/meme-delivery.server", () => ({ getReviewedMemeMediaSources: mocks.getReviewedMemeMediaSources }));
vi.mock("@/lib/meme-market-passport.server", () => ({ getMemeMarketPassport: async () => null }));
vi.mock("@/lib/index-gate.server", () => ({ loadDiscoveryIndex: async () => ({ ok: true, ids: new Set() }) }));
vi.mock("@/components/save-button", () => ({ SaveButton: () => null }));
vi.mock("@/components/export-button", () => ({ ExportButton: () => null }));
vi.mock("@/components/share-button", () => ({ ShareButton: () => null }));
vi.mock("@/components/meme-market-passport", () => ({ MemeMarketPassport: () => null }));
vi.mock("@/components/related-memes", () => ({ RelatedMemes: () => null }));

import LocalizedMemePage from "@/app/[locale]/memes/[key]/page";

const youtube = {
  id: "content-1", platform: "YouTube", content_id: "abcdefghijk",
  url: "https://www.youtube.com/watch?v=abcdefghijk", availability: "live",
  moderation_status: "approved", is_representative: true, thumbnail_url: null as string | null,
  caption: null, type: "embed", manual_video_verified: false,
};
const ledger = {
  review_state: "approved", rights_basis: "official_embed", platform: "youtube",
  external_id: youtube.content_id, canonical_url: youtube.url, embeddable: true,
  public_status: "public", removed_at: null, last_checked_at: new Date().toISOString(),
};

async function renderPage(contents: (Omit<typeof youtube, "url"> & { url: string | null })[], sources: unknown, locale = "en") {
  mocks.getLocalizedMemeByShortId.mockResolvedValue({
    id: "meme-1", short_id: "abc12345", slug: "test-meme", title: "Test meme",
    summary: "A test meme", category: "phrase", safety_level: "green",
    description: "Meaning", origin: null, usage_note: null, caution: null,
    usage_context: null, origin_year: null, published_at: null, meme_contents: contents,
    meme_sources: [], meme_tags_map: [], original: { title: "테스트", slug: "test-meme" },
    translation: { locale, status: "reviewed", isCurrent: true, updatedAt: "2026-11-18T00:00:00.000Z" },
  });
  mocks.getReviewedMemeMediaSources.mockResolvedValue(sources);
  const page = await LocalizedMemePage({ params: Promise.resolve({ locale, key: "abc12345-test-meme" }) });
  return renderToStaticMarkup(page);
}

describe("localized detail playback", () => {
  it.each(["en", "ja"])("renders the existing approved identity on the %s route", async (locale) => {
    const html = await renderPage([youtube], { ok: true, sources: [ledger] }, locale);
    expect(html).toContain("https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0");
  });

  it("allows duplicate rows for the same video", async () => {
    const html = await renderPage([youtube, { ...youtube, id: "duplicate" }], { ok: true, sources: [ledger] });
    expect(html).toContain("https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0");
  });

  it.each([true, false])("does not let an image veto a unique video; image representative=%s", async (isRepresentative) => {
    const image = { ...youtube, id: "image", type: "image", platform: "website", content_id: "image123", url: "https://example.com/image.jpg", is_representative: isRepresentative };
    const video = { ...youtube, is_representative: false };
    const html = await renderPage([image, video], { ok: true, sources: [ledger] });
    expect(html).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
  });

  it("ignores an unverified Instagram post representative when there is a unique safe video", async () => {
    const post = { ...youtube, id: "post", platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: false };
    const video = { ...youtube, is_representative: false };
    const html = await renderPage([post, video], { ok: true, sources: [ledger] });
    expect(html).toContain("i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(html).not.toContain("/p/Post123/embed/captioned/");
  });

  it("does not choose between two different nonrepresentative videos alongside an image", async () => {
    const first = { ...youtube, is_representative: false };
    const second = { ...first, id: "second", content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv" };
    const image = { ...youtube, id: "image", type: "image", platform: "website", content_id: "image123", url: "https://example.com/image.jpg", is_representative: true };
    const html = await renderPage([image, first, second], { ok: true, sources: [] });
    expect(html).not.toContain("youtube-nocookie.com/embed/");
    expect(html).not.toContain("i.ytimg.com/vi/");
  });

  it("does not promote multiple different nonrepresentative videos", async () => {
    const first = { ...youtube, is_representative: false };
    const second = { ...first, id: "second", content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv" };
    const html = await renderPage([first, second], { ok: true, sources: [] });
    expect(html).not.toContain("youtube-nocookie.com/embed/");
    expect(html).not.toContain("i.ytimg.com/vi/");
  });

  it.each([false, true])("keeps the approved representative when an unrelated video is present, blocked=%s", async (blocked) => {
    const other = { ...youtube, id: "second", content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv", is_representative: false };
    const otherSource = { ...ledger, external_id: other.content_id, canonical_url: other.url, rights_basis: blocked ? "blocked" : "official_embed" };
    const html = await renderPage([youtube, other], { ok: true, sources: [ledger, otherSource] });
    expect(html).toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(html).not.toContain("youtube-nocookie.com/embed/lmnopqrstuv");
  });

  it("plays a unique URL-less YouTube identity and matches its duplicate URL row", async () => {
    const withoutUrl = { ...youtube, url: null, thumbnail_url: "/api/media/meme-card-art/example" };
    const html = await renderPage([withoutUrl, { ...youtube, id: "duplicate" }], { ok: true, sources: [ledger] });
    expect(html).toContain("youtube-nocookie.com/embed/abcdefghijk");
  });

  it("does not choose between different approved representative identities", async () => {
    const other = { ...youtube, id: "second", content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv" };
    const html = await renderPage([youtube, other], { ok: true, sources: [] });
    expect(html).not.toContain("youtube-nocookie.com/embed/");
  });

  it("uses the unique approved fallback after a representative is blocked", async () => {
    const other = { ...youtube, id: "second", content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv", is_representative: false };
    const otherSource = { ...ledger, external_id: other.content_id, canonical_url: other.url };
    const html = await renderPage([youtube, other], { ok: true, sources: [{ ...ledger, rights_basis: "blocked" }, otherSource] });
    expect(html).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(html).toContain("i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg");
  });

  it("distinguishes Instagram post and reel URLs with the same shortcode", async () => {
    const post = { ...youtube, platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: true };
    const reel = { ...post, id: "other", url: "https://www.instagram.com/reel/Post123/" };
    const html = await renderPage([post, reel], { ok: true, sources: [] });
    expect(html).not.toContain("/embed/captioned/");
  });

  it.each([false, true])("treats TikTok account aliases as one video identity, representative=%s", async (isRepresentative) => {
    const id = "1234567890123456789";
    const old = { ...youtube, id: "old", platform: "TikTok", content_id: id, url: `https://www.tiktok.com/@old/video/${id}`, is_representative: isRepresentative };
    const renamed = { ...old, id: "new", url: `https://www.tiktok.com/@new/video/${id}` };
    const oldSource = { ...ledger, platform: "tiktok", external_id: id, canonical_url: old.url, public_status: null };
    const newSource = { ...oldSource, canonical_url: renamed.url };
    for (const contents of [[old, renamed], [renamed, old]]) {
      const html = await renderPage(contents, { ok: true, sources: [oldSource, newSource] });
      expect(html).toContain(`https://www.tiktok.com/player/v1/${id}`);
    }
  });

  it("does not choose between different TikTok video identities", async () => {
    const firstId = "1234567890123456789";
    const secondId = "1234567890123456790";
    const first = { ...youtube, platform: "TikTok", content_id: firstId, url: `https://www.tiktok.com/@old/video/${firstId}`, is_representative: false };
    const second = { ...first, id: "second", content_id: secondId, url: `https://www.tiktok.com/@new/video/${secondId}` };
    const sources = [first, second].map((content) => ({ ...ledger, platform: "tiktok", external_id: content.content_id, canonical_url: content.url, public_status: null }));
    const html = await renderPage([first, second], { ok: true, sources });
    expect(html).not.toContain("https://www.tiktok.com/player/v1/");
  });

  it("keeps source rights checks on each TikTok alias", async () => {
    const id = "1234567890123456789";
    const old = { ...youtube, id: "old", platform: "TikTok", content_id: id, url: `https://www.tiktok.com/@old/video/${id}` };
    const renamed = { ...old, id: "new", url: `https://www.tiktok.com/@new/video/${id}` };
    const source = { ...ledger, platform: "tiktok", external_id: id, canonical_url: old.url, public_status: null };
    const html = await renderPage([old, renamed], { ok: true, sources: [{ ...source, rights_basis: "blocked" }, { ...source, canonical_url: renamed.url }] });
    expect(html).toContain(`https://www.tiktok.com/player/v1/${id}`);
    expect(html).toContain(`href="${renamed.url}"`);
  });

  it.each([
    ["en", "Representative video", "Play related video"],
    ["ja", "代表動画", "関連動画を再生"],
    ["zh", "代表视频", "播放相关视频"],
    ["zh-tw", "代表影片", "播放相關影片"],
  ])("localizes iframe and playback labels for %s", async (locale, iframeLabel, buttonLabel) => {
    const iframe = await renderPage([youtube], { ok: true, sources: [ledger] }, locale);
    expect(iframe).toContain(iframeLabel);
    const button = await renderPage([{ ...youtube, is_representative: false }], { ok: true, sources: [ledger] }, locale);
    expect(button).toContain(buttonLabel);
    expect(button).not.toContain("관련 영상 재생");
  });

  it.each([
    { ok: false, sources: [] },
    { ok: true, sources: [{ ...ledger, rights_basis: "blocked" }] },
    { ok: true, sources: [{ ...ledger, public_status: "private" }] },
  ])("keeps existing unavailable and blocked source policy", async (sources) => {
    const html = await renderPage([youtube], sources);
    expect(html).not.toContain("youtube-nocookie.com/embed/abcdefghijk");
  });

  it.each([false, true])("requires manual video verification for Instagram /p/: %s", async (verified) => {
    const post = { ...youtube, platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: verified };
    const source = { ...ledger, platform: "instagram", external_id: post.content_id, canonical_url: post.url, public_status: null };
    const html = await renderPage([post], { ok: true, sources: [source] });
    if (verified) expect(html).toContain("https://www.instagram.com/p/Post123/embed/captioned/");
    else expect(html).not.toContain("/embed/captioned/");
  });

  it.each([
    ["en", "Open post", "Representative content"],
    ["ja", "投稿を開く", "代表コンテンツ"],
    ["zh", "打开帖子", "代表内容"],
    ["zh-tw", "開啟貼文", "代表內容"],
  ])("localizes the social iframe and link on the %s route", async (locale, openPost, frameTitle) => {
    const post = { ...youtube, platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/reel/Post123/" };
    const source = { ...ledger, platform: "instagram", external_id: post.content_id, canonical_url: post.url, public_status: null };
    const html = await renderPage([post], { ok: true, sources: [source] }, locale);
    expect(html).toContain(openPost);
    expect(html).toContain(frameTitle);
  });

  it("uses the video URL platform for TikTok when a legacy platform label conflicts", async () => {
    const video = { ...youtube, platform: "Instagram", content_id: "1234567890123456789", url: "https://www.tiktok.com/@creator/video/1234567890123456789" };
    const source = { ...ledger, platform: "tiktok", external_id: video.content_id, canonical_url: video.url, public_status: null };
    const html = await renderPage([video], { ok: true, sources: [source] });
    expect(html).toContain("https://www.tiktok.com/player/v1/1234567890123456789");
  });
});
