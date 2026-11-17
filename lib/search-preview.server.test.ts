import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ in: mocks.query }) }) }),
}));
import { qualifySearchPreviews } from "./search-preview.server";
import type { MemeListItem } from "./queries";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const content = (id: string, representative = true) => ({
  platform: "YouTube", content_id: id, url: `https://www.youtube.com/watch?v=${id}`,
  is_representative: representative, availability: "live", moderation_status: "approved", thumbnail_url: null,
});
const card = (n: number, contents = [content("abcdefghijk")]) => ({ id: uuid(n), meme_contents: contents }) as MemeListItem;
const row = (memeId: string, id = "abcdefghijk", rights = "blocked") => ({
  meme_id: memeId, review_state: "approved", rights_basis: rights,
  media_sources: { platform: "youtube", external_id: id, canonical_url: `https://www.youtube.com/watch?v=${id}`, embeddable: true, public_status: "public", removed_at: null, last_checked_at: null },
});
beforeEach(() => mocks.query.mockReset());

describe("search preview batch", () => {
  it("avoids a query for an empty or curated-only set", async () => {
    expect(await qualifySearchPreviews([])).toEqual([]);
    const curated = { ...card(1), id: "curated-abc" };
    expect(await qualifySearchPreviews([curated])).toEqual([undefined]);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("batches and deduplicates thousands of ids without dropping results", async () => {
    mocks.query.mockResolvedValue({ data: [], error: null });
    const cards = Array.from({ length: 2401 }, (_, i) => card(i + 1));
    const previews = await qualifySearchPreviews([...cards, cards[0]]);
    expect(previews).toHaveLength(2402);
    expect(previews.every((value) => value?.length === 1)).toBe(true);
    expect(mocks.query).toHaveBeenCalledTimes(13);
    expect(mocks.query.mock.calls.every((call) => call[1].length <= 200)).toBe(true);
  });
  it("applies current policy, including an empty successful ledger and a unique safe alternate", async () => {
    const first = card(1, [content("abcdefghijk"), content("lmnopqrstuv", false)]);
    const second = card(2);
    mocks.query.mockResolvedValue({ data: [row(first.id)], error: null });
    const result = await qualifySearchPreviews([first, second]);
    expect(result[0]?.map((item) => item.content_id)).toEqual(["lmnopqrstuv"]);
    expect(result[1]?.map((item) => item.content_id)).toEqual(["abcdefghijk"]);
  });
  it("preserves a verified Instagram preview with a successful empty ledger", async () => {
    const post = { ...content("abcdefghijk"), platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: true };
    mocks.query.mockResolvedValue({ data: [], error: null });
    expect((await qualifySearchPreviews([card(1, [post])]))[0]).toEqual([post]);
  });
  it("does not promote an arbitrary alternate after a blocked representative", async () => {
    const item = card(1, [content("abcdefghijk"), content("lmnopqrstuv", false), content("zyxwvutsrqp", false)]);
    mocks.query.mockResolvedValue({ data: [row(item.id)], error: null });
    expect(await qualifySearchPreviews([item])).toEqual([[]]);
  });
  it.each([
    { data: null, error: { message: "unavailable" } },
    { data: {}, error: null },
    { data: [{ meme_id: uuid(1), review_state: "approved" }], error: null },
    { data: [row(uuid(99))], error: null },
  ])("fails closed on lookup errors or damaged responses", async (response) => {
    mocks.query.mockResolvedValue(response);
    expect(await qualifySearchPreviews([card(1)])).toEqual([[]]);
  });
  it("does not let a failed batch contaminate another batch", async () => {
    mocks.query.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } }).mockResolvedValueOnce({ data: [], error: null });
    const cards = Array.from({ length: 201 }, (_, i) => card(i + 1));
    const previews = await qualifySearchPreviews(cards);
    expect(previews.slice(0, 200).every((value) => value?.length === 0)).toBe(true);
    expect(previews[200]).toHaveLength(1);
  });
  it("isolates a malformed row to its meme and preserves the other card in the same batch", async () => {
    const bad = card(1);
    const good = card(2);
    const malformed = { ...row(bad.id), rights_basis: "invalid-rights" };
    mocks.query.mockResolvedValue({ data: [malformed, row(good.id, "abcdefghijk", "official_embed")], error: null });
    const onFailure = vi.fn();
    const previews = await qualifySearchPreviews([bad, good], { onFailure });
    expect(previews[0]).toEqual([]);
    expect(previews[1]).toEqual(good.meme_contents);
    expect(onFailure).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("logs a safe category and count without row values", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const item = card(1);
      mocks.query.mockResolvedValue({ data: [{ ...row(item.id), rights_basis: "sensitive-test-value" }], error: null });
      await qualifySearchPreviews([item]);
      expect(warn).toHaveBeenCalledWith("[search-preview] malformed ledger rows: 1");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-test-value");
      expect(JSON.stringify(warn.mock.calls)).not.toContain(item.id);
    } finally {
      warn.mockRestore();
    }
  });
  it("fails closed on malformed catalog content", async () => {
    mocks.query.mockResolvedValue({ data: [], error: null });
    const damaged = { ...card(1), meme_contents: [{ url: 42 }] } as unknown as MemeListItem;
    expect(await qualifySearchPreviews([damaged])).toEqual([[]]);
  });
  it("uses fresh ledger results for a subsequent rights withdrawal", async () => {
    const item = card(1);
    mocks.query.mockResolvedValueOnce({ data: [row(item.id, "abcdefghijk", "official_embed")], error: null })
      .mockResolvedValueOnce({ data: [row(item.id)], error: null });
    expect((await qualifySearchPreviews([item]))[0]).toHaveLength(1);
    expect((await qualifySearchPreviews([item]))[0]).toEqual([]);
  });
  it("does not allow extra source fields to overwrite restrictive ledger rights", async () => {
    const item = card(1);
    const blocked = row(item.id);
    mocks.query.mockResolvedValue({ data: [{ ...blocked, media_sources: { ...blocked.media_sources, rights_basis: "official_embed" } }], error: null });
    expect((await qualifySearchPreviews([item]))[0]).toEqual([]);
  });
});
