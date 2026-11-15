import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { checkCatalogMemeDuplicates, registerCatalogMeme } from "./admin-catalog";

const input = {
  registrationKey: "10000000-0000-4000-8000-000000000001",
  title: "테스트 밈",
  aliases: [],
  summary: "테스트 요약",
  description: "테스트 설명",
  origin: "검증 전인 테스트 유래",
  sourceWorkYear: 2020,
  memeFirstSeenYear: 2021,
  koreaViralYear: 2022,
  yearPrecision: "year" as const,
  tags: ["테스트"],
  safetyLevel: "yellow" as const,
  category: "image" as const,
  difficulty: "normal" as const,
  sentiment: "funny" as const,
  usageContext: { work: "yellow", friends: "green", family: "yellow", sns: "yellow" } as const,
  sources: [
    { url: "https://archive.org/details/original", platform: "web" as const, sourceRole: "earliest_known" as const, rightsBasis: "unknown" as const },
    { url: "https://www.bbc.com/culture/reference", platform: "web" as const, sourceRole: "secondary_reference" as const, rightsBasis: "link_only" as const },
  ],
};

function client(rpc: ReturnType<typeof vi.fn>, user: object | null = { id: "operator" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("catalog admin actions", () => {
  it("rejects signed-out and non-operator callers before mutation", async () => {
    const signedOutRpc = vi.fn();
    mocks.createClient.mockResolvedValueOnce(client(signedOutRpc, null));
    expect((await registerCatalogMeme(input)).ok).toBe(false);
    expect(signedOutRpc).not.toHaveBeenCalled();

    const memberRpc = vi.fn().mockResolvedValueOnce({ data: false, error: null });
    mocks.createClient.mockResolvedValueOnce(client(memberRpc));
    expect((await registerCatalogMeme(input)).ok).toBe(false);
    expect(memberRpc).toHaveBeenCalledTimes(1);
  });

  it("returns duplicate matches without creating a second meme", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { status: "duplicate", matches: [{ reason: "source", memeId: "m1", title: "기존", shortId: "abcd1234", slug: "existing", sourceUrl: "https://archive.org/details/original" }] }, error: null });
    mocks.createClient.mockResolvedValueOnce(client(rpc));
    await expect(registerCatalogMeme(input)).resolves.toMatchObject({
      ok: true,
      data: { status: "duplicate", matches: [{ memeId: "m1" }] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a repeated request key as a successful retry and revalidates admin pages", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { status: "duplicate_request", memeId: "m1", shortId: "abcd1234", slug: "test" }, error: null });
    mocks.createClient.mockResolvedValueOnce(client(rpc));
    await expect(registerCatalogMeme(input)).resolves.toMatchObject({
      ok: true,
      data: { status: "duplicate_request", memeId: "m1" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/memes/m1");
  });

  it("normalizes URLs before a read-only duplicate check", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.createClient.mockResolvedValueOnce(client(rpc));
    await expect(checkCatalogMemeDuplicates({
      title: "테스트 밈",
      sourceUrls: ["https://archive.org/details/original#fragment"],
    })).resolves.toEqual({ ok: true, data: { matches: [] } });
    expect(rpc).toHaveBeenLastCalledWith("find_catalog_meme_duplicates", {
      p_title: "테스트 밈",
      p_source_urls: ["https://archive.org/details/original"],
    });
  });
});
