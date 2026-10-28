import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { createHouseOriginal, transitionMemeStatus, updateMeme } from "./admin";

const operatorId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";
const originalMediaClassificationFlag = process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED;

type FromHandler = (table: string) => unknown;

function operatorClient(options: {
  from: FromHandler;
  rpc?: (name: string, args?: unknown) => unknown;
  user?: { id: string } | null;
  role?: string;
}) {
  const from: FromHandler = (table) => options.from(table);
  const rpc = options.rpc ?? vi.fn();

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? { id: operatorId } : options.user },
      }),
    },
    from,
    rpc: vi.fn((name: string, args?: unknown) => name === "is_operator"
      ? Promise.resolve({ data: (options.role ?? "operator") === "operator", error: null })
      : rpc(name, args)),
  };
}

function memesInsertClient(insertImpl: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }>) {
  const insert = vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn(insertImpl),
    }),
  }));
  const sourcesInsert = vi.fn().mockResolvedValue({ error: null });
  const marketProfilesInsert = vi.fn().mockResolvedValue({ error: null });
  return {
    client: operatorClient({
      from: (table) => {
        if (table === "memes") return { insert };
        if (table === "meme_sources") return { insert: sourcesInsert };
        if (table === "meme_market_profiles") return { insert: marketProfilesInsert };
        throw new Error(`unexpected table ${table}`);
      },
    }),
    insert,
    sourcesInsert,
    marketProfilesInsert,
  };
}

const createInput = {
  title: "자체 제작 테스트",
  summary: "밈캐치가 만든 형식이에요.",
  description: "설명",
  origin: "밈캐치 스튜디오에서 만들었어요.",
  safetyLevel: "green" as const,
  category: "phrase" as const,
  difficulty: "beginner" as const,
  originYear: 2026,
  usageContext: { work: "green" as const, friends: "green" as const, family: "green" as const, sns: "green" as const },
  country: "US" as const,
  localTitle: "Original local title",
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED;
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  });
});

afterEach(() => {
  if (originalMediaClassificationFlag === undefined) {
    delete process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED;
  } else {
    process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED = originalMediaClassificationFlag;
  }
});

describe("createHouseOriginal", () => {
  it("rejects non-operators before insert", async () => {
    const signedOut = operatorClient({
      user: null,
      from: () => {
        throw new Error("unexpected");
      },
    });
    mocks.createClient.mockResolvedValueOnce(signedOut);
    await expect(createHouseOriginal(createInput)).resolves.toEqual({
      ok: false,
      error: "로그인이 필요해요.",
    });

    const member = operatorClient({
      role: "user",
      from: () => {
        throw new Error("unexpected");
      },
    });
    mocks.createClient.mockResolvedValueOnce(member);
    await expect(createHouseOriginal(createInput)).resolves.toEqual({
      ok: false,
      error: "운영자 권한이 없어요.",
    });
  });

  it("inserts pending house_original only and does not walk status", async () => {
    const { client, insert, sourcesInsert, marketProfilesInsert } = memesInsertClient(async () => ({
      data: { id: memeId, short_id: "abcd1234", slug: "자체-제작-테스트" },
      error: null,
    }));
    mocks.createClient.mockResolvedValue(client);

    await expect(createHouseOriginal(createInput)).resolves.toEqual({
      ok: true,
      data: { memeId },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        origin_kind: "house_original",
        moderation_status: "pending",
        title: "자체 제작 테스트",
      }),
    );
    expect(insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ house_rights_attested_at: expect.anything() }),
    );
    expect(client.rpc).toHaveBeenCalledWith("is_operator");
    expect(sourcesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        meme_id: memeId,
        source_role: "original",
        rights_basis: "creator_permission",
      }),
    );
    expect(marketProfilesInsert).toHaveBeenCalledWith({
      meme_id: memeId,
      market_code: "US",
      language_tag: "en-US",
      role: "origin",
      local_title: "Original local title",
      review_state: "reviewed",
      reviewed_at: expect.any(String),
      reviewed_by: operatorId,
    });
  });

  it("returns a partial-create error when the reviewed origin profile cannot be linked", async () => {
    const { client, marketProfilesInsert } = memesInsertClient(async () => ({
      data: { id: memeId, short_id: "abcd1234", slug: "자체-제작-테스트" },
      error: null,
    }));
    marketProfilesInsert.mockResolvedValueOnce({ error: { message: "profile failed" } });
    mocks.createClient.mockResolvedValue(client);

    await expect(createHouseOriginal(createInput)).resolves.toEqual({
      ok: false,
      error: `자체 제작 항목과 권리 출처는 만들어졌지만 국가 프로필 연결에 실패했어요: profile failed — 밈 관리에서 이어서 처리해 주세요. (id: ${memeId})`,
    });
  });

  it("rejects an unsupported country before creating the meme", async () => {
    const { client, insert } = memesInsertClient(async () => {
      throw new Error("insert should not run");
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(createHouseOriginal({
      ...createInput,
      country: "ZZ" as "US",
    })).resolves.toEqual({ ok: false, error: "밈 국가를 확인해 주세요." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects operator scratch origin copy before insert", async () => {
    const { client, insert } = memesInsertClient(async () => {
      throw new Error("insert should not run");
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      createHouseOriginal({
        ...createInput,
        origin:
          "밈캐치 운영자가 자체 제작 등록으로 제목·요약·제작 경위만 적어 pending으로 저장했다. 사실 확인·권리 확인·게시는 하지 않았다.",
      }),
    ).resolves.toEqual({
      ok: false,
      error:
        "제작 경위에 검수·게시 과정 메모가 들어가 있어요. 게스트에게 보이는 문장이니, 밈캐치가 어떻게 만들었는지만 적어 주세요.",
    });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("transitionMemeStatus house original gate", () => {
  function transitionClient(originKind: string) {
    const memeRead = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { short_id: "abcd1234", slug: "test", origin_kind: originKind, meme_translations: [] },
        error: null,
      }),
    };
    memeRead.select.mockReturnValue(memeRead);
    memeRead.eq.mockReturnValue(memeRead);
    const memeUpdate = { update: vi.fn(), eq: vi.fn().mockResolvedValue({ error: null }) };
    memeUpdate.update.mockReturnValue(memeUpdate);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    let memesCalls = 0;
    const client = operatorClient({
      rpc,
      from: (table) => {
        if (table !== "memes") throw new Error(`unexpected table ${table}`);
        memesCalls += 1;
        return memesCalls === 1 ? memeRead : memeUpdate;
      },
    });
    return { client, memeUpdate, rpc, memeRead };
  }

  it("refuses approved without attestation and does not call the RPC", async () => {
    const { client, rpc, memeUpdate } = transitionClient("house_original");
    mocks.createClient.mockResolvedValue(client);

    await expect(
      transitionMemeStatus({ memeId, to: "approved" }),
    ).resolves.toEqual({
      ok: false,
      error: "자체 제작 권리 확인에 동의해 주세요.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(memeUpdate.update).not.toHaveBeenCalled();
  });

  it("publishes house originals through publish_house_original", async () => {
    const { client, rpc, memeUpdate } = transitionClient("house_original");
    mocks.createClient.mockResolvedValue(client);

    await expect(
      transitionMemeStatus({ memeId, to: "approved", attested: true }),
    ).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_house_original", {
      p_meme_id: memeId,
      p_to: "approved",
      p_attested: true,
    });
    expect(memeUpdate.update).not.toHaveBeenCalled();
  });

  it("keeps catalog transitions on the existing update path", async () => {
    const { client, rpc, memeUpdate } = transitionClient("catalog");
    mocks.createClient.mockResolvedValue(client);

    await expect(transitionMemeStatus({ memeId, to: "approved" })).resolves.toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
    expect(memeUpdate.update).toHaveBeenCalledWith({
      moderation_status: "approved",
      updated_at: expect.any(String),
    });
  });
});

describe("updateMeme house original copy revert", () => {
  const updateInput = {
    memeId,
    title: "자체 제작 테스트",
    summary: "밈캐치가 만든 형식이에요.",
    description: "설명",
    origin: "2026년 밈캐치가 자체 그래픽으로 만들었다.",
    usageNote: "",
    caution: "",
    aliases: [] as string[],
    safetyLevel: "green" as const,
    lifecycleStatus: "active" as const,
    category: "phrase" as const,
    difficulty: "beginner" as const,
    sentiment: "funny" as const,
    originYear: 2026,
    usageContext: {
      work: "green" as const,
      friends: "green" as const,
      family: "green" as const,
      sns: "green" as const,
    },
  };

  function updateClient(options: {
    originKind: string;
    previousStatus: string;
    nextStatus: string;
  }) {
    const identityRead = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          short_id: "abcd1234",
          slug: "test",
          origin_kind: options.originKind,
          moderation_status: options.previousStatus,
          meme_translations: [],
        },
        error: null,
      }),
    };
    identityRead.select.mockReturnValue(identityRead);
    identityRead.eq.mockReturnValue(identityRead);

    const afterRead = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { moderation_status: options.nextStatus },
        error: null,
      }),
    };
    afterRead.select.mockReturnValue(afterRead);
    afterRead.eq.mockReturnValue(afterRead);

    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    let memesCalls = 0;
    const client = operatorClient({
      rpc,
      from: (table) => {
        if (table !== "memes") throw new Error(`unexpected table ${table}`);
        memesCalls += 1;
        return memesCalls === 1 ? identityRead : afterRead;
      },
    });
    return { client, rpc, afterRead };
  }

  it("keeps legacy edits free of a media_type key when the field is omitted", async () => {
    const { client, rpc } = updateClient({
      originKind: "catalog",
      previousStatus: "approved",
      nextStatus: "approved",
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(updateMeme(updateInput)).resolves.toEqual({
      ok: true,
      data: { safetyReviewQueued: false, revertedToRightsChecking: false },
    });
    const rpcArgs = rpc.mock.calls[0]?.[1] as { p_content: Record<string, unknown> };
    expect(rpcArgs.p_content).not.toHaveProperty("media_type");
  });

  it("rejects an explicit media type while the rollout flag is off before auth or RPC", async () => {
    await expect(updateMeme({ ...updateInput, mediaType: "video" })).resolves.toEqual({
      ok: false,
      error: "미디어 분류 편집이 아직 활성화되지 않았어요.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid media type before auth or RPC", async () => {
    process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED = "true";
    await expect(
      updateMeme({ ...updateInput, mediaType: "document" as "video" }),
    ).resolves.toEqual({ ok: false, error: "미디어 분류를 확인해 주세요." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated operator before forwarding an enabled media type", async () => {
    process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED = "true";
    const signedOut = operatorClient({
      user: null,
      from: () => {
        throw new Error("unexpected");
      },
    });
    mocks.createClient.mockResolvedValue(signedOut);

    await expect(updateMeme({ ...updateInput, mediaType: "video" })).resolves.toEqual({
      ok: false,
      error: "로그인이 필요해요.",
    });
    expect(signedOut.rpc).not.toHaveBeenCalled();
  });

  it("forwards an enabled media type through the existing review RPC", async () => {
    process.env.ADMIN_MEDIA_CLASSIFICATION_ENABLED = "true";
    const { client, rpc } = updateClient({
      originKind: "catalog",
      previousStatus: "approved",
      nextStatus: "approved",
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(updateMeme({ ...updateInput, mediaType: "video" })).resolves.toEqual({
      ok: true,
      data: { safetyReviewQueued: false, revertedToRightsChecking: false },
    });
    expect(rpc).toHaveBeenCalledWith("update_meme_with_safety_review", {
      p_meme_id: memeId,
      p_proposed_level: "green",
      p_content: expect.objectContaining({ media_type: "video" }),
    });
  });

  it("returns revertedToRightsChecking when published copy edit falls back", async () => {
    const { client, rpc, afterRead } = updateClient({
      originKind: "house_original",
      previousStatus: "approved",
      nextStatus: "rights_checking",
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(updateMeme(updateInput)).resolves.toEqual({
      ok: true,
      data: { safetyReviewQueued: false, revertedToRightsChecking: true },
    });
    expect(rpc).toHaveBeenCalledWith(
      "update_meme_with_safety_review",
      expect.objectContaining({ p_meme_id: memeId }),
    );
    expect(afterRead.select).toHaveBeenCalled();
  });

  it("does not claim revert on catalog or unpublished house originals", async () => {
    const catalog = updateClient({
      originKind: "catalog",
      previousStatus: "approved",
      nextStatus: "approved",
    });
    mocks.createClient.mockResolvedValue(catalog.client);
    await expect(updateMeme(updateInput)).resolves.toEqual({
      ok: true,
      data: { safetyReviewQueued: false, revertedToRightsChecking: false },
    });
    expect(catalog.afterRead.select).not.toHaveBeenCalled();

    const pending = updateClient({
      originKind: "house_original",
      previousStatus: "pending",
      nextStatus: "pending",
    });
    mocks.createClient.mockResolvedValue(pending.client);
    await expect(updateMeme(updateInput)).resolves.toEqual({
      ok: true,
      data: { safetyReviewQueued: false, revertedToRightsChecking: false },
    });
    expect(pending.afterRead.select).not.toHaveBeenCalled();
  });
});
