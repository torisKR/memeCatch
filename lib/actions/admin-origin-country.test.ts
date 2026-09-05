import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { setMemeOriginCountry } from "./admin";

const operatorId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";

function client(rpcError: { message: string } | null = null) {
  const meme = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        short_id: "abcd1234",
        slug: "test",
        origin_kind: "catalog",
        moderation_status: "approved",
        meme_translations: [],
      },
      error: null,
    }),
  };
  meme.select.mockReturnValue(meme);
  meme.eq.mockReturnValue(meme);

  const rpc = vi.fn().mockResolvedValue({ data: { marketCode: "JP" }, error: rpcError });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: operatorId } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "memes") return meme;
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn((name: string, args?: unknown) => name === "is_operator"
      ? Promise.resolve({ data: true, error: null })
      : rpc(name, args)),
  };
  return { supabase, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  });
});

describe("setMemeOriginCountry", () => {
  it("upserts one reviewed origin country and removes every other origin profile", async () => {
    const { supabase, rpc } = client();
    mocks.createClient.mockResolvedValue(supabase);

    await expect(
      setMemeOriginCountry({ memeId, country: "JP", localTitle: "  猫ミーム  " }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("set_meme_origin_country", {
      p_meme_id: memeId,
      p_market_code: "JP",
      p_local_title: "猫ミーム",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/memes/${memeId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/global");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/explore");
    for (const path of ["/", "/daily", "/rankings", "/weekly", "/timeline", "/news"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/collections/[slug]", "page");
    for (const locale of ["en", "ja", "zh", "zh-tw"]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(`/${locale}/explore`);
    }
  });

  it("rejects invalid input before reading or changing a meme", async () => {
    const { supabase, rpc } = client();
    mocks.createClient.mockResolvedValue(supabase);

    await expect(
      setMemeOriginCountry({ memeId: "bad", country: "JP", localTitle: "제목" }),
    ).resolves.toEqual({ ok: false, error: "밈 식별자를 확인해 주세요." });
    await expect(
      setMemeOriginCountry({ memeId, country: "ZZ" as "JP", localTitle: "제목" }),
    ).resolves.toEqual({ ok: false, error: "밈 국가를 확인해 주세요." });
    await expect(
      setMemeOriginCountry({ memeId, country: "JP", localTitle: "   " }),
    ).resolves.toEqual({ ok: false, error: "현지 제목은 1~300자로 입력해 주세요." });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("redacts unexpected RPC details behind a stable Korean error", async () => {
    const { supabase } = client({
      message: "connection failed for postgres://secret-user:secret-password@example.com",
    });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await setMemeOriginCountry({ memeId, country: "JP", localTitle: "猫ミーム" });

    expect(result).toEqual({
      ok: false,
      error: "출처 국가를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    });
    expect(JSON.stringify(result)).not.toContain("secret-password");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
