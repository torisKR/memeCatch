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

import { createHouseOriginal, transitionMemeStatus } from "./admin";

const operatorId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";

type FromHandler = (table: string) => unknown;

function operatorClient(options: {
  from: FromHandler;
  rpc?: ReturnType<typeof vi.fn>;
  user?: { id: string } | null;
  role?: string;
}) {
  const profile = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: { role: options.role ?? "operator" },
      error: null,
    }),
  };
  profile.select.mockReturnValue(profile);
  profile.eq.mockReturnValue(profile);

  const from: FromHandler = (table) => {
    if (table === "profiles") return profile;
    return options.from(table);
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? { id: operatorId } : options.user },
      }),
    },
    from,
    rpc: options.rpc ?? vi.fn(),
  };
}

function memesInsertClient(insertImpl: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }>) {
  const insert = vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn(insertImpl),
    }),
  }));
  const sourcesInsert = vi.fn().mockResolvedValue({ error: null });
  return {
    client: operatorClient({
      from: (table) => {
        if (table === "memes") return { insert };
        if (table === "meme_sources") return { insert: sourcesInsert };
        throw new Error(`unexpected table ${table}`);
      },
    }),
    insert,
    sourcesInsert,
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
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  });
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
    const { client, insert, sourcesInsert } = memesInsertClient(async () => ({
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
    expect(client.rpc).not.toHaveBeenCalled();
    expect(sourcesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        meme_id: memeId,
        source_role: "original",
        rights_basis: "creator_permission",
      }),
    );
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
