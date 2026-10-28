import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  generateVideoDraft: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/video-production/draft.server", () => ({ generateVideoDraft: mocks.generateVideoDraft }));

import { performVideoProductionCommand } from "./admin-video-productions";

const userId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";
const productionId = "30000000-0000-4000-8000-000000000003";
const channelConnectionId = "40000000-0000-4000-8000-000000000004";
const hash = "a".repeat(64);

const scenes = [
  { id: "hook", kind: "hook", heading: "도입", caption: "표현을 살펴봅니다", narration: "표현을 먼저 살펴봅니다.", start_ms: 0, end_ms: 6_000, source_ids: ["source:one"] },
  { id: "meaning", kind: "meaning", heading: "뜻", caption: "검수된 뜻", narration: "검수된 뜻을 설명합니다.", start_ms: 6_000, end_ms: 13_000, source_ids: ["source:one"] },
  { id: "example", kind: "example", heading: "가상 상황", caption: "자체 작성 대화", narration: "자체 작성한 가상 상황입니다.", start_ms: 13_000, end_ms: 21_000, source_ids: [] },
  { id: "context", kind: "context", heading: "맥락", caption: "확인된 맥락", narration: "검수된 맥락을 설명합니다.", start_ms: 21_000, end_ms: 29_000, source_ids: ["source:one"] },
  { id: "caution", kind: "caution", heading: "주의", caption: "상황에 맞게 사용", narration: "상황에 맞게 풀어 말합니다.", start_ms: 29_000, end_ms: 36_000, source_ids: [] },
];
const script = {
  title: "테스트 밈", description: "검수된 근거와 자체 작성 가상 상황으로 사용 맥락을 설명합니다.",
  narration: scenes.map((scene) => scene.narration).join(" "),
  original_observation: "이 표현은 친근한 대화에서 상황을 짧게 압축하는 특징이 있습니다.",
  scenes, source_ids: ["source:one"], uncertain_claims: [],
  asset_requirements: [{ kind: "voice", description: "자체 음성" }, { kind: "font", description: "허가된 폰트" }, { kind: "graphic", description: "자체 그래픽" }],
  contains_synthetic_media: false,
};
const assets = [{
  id: "voice:1", kind: "voice", source_url: null, owner: "MemeCatch", acquisition_method: "self_created",
  allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null, valid_until: null,
  territories: ["worldwide"], evidence: "내부 제작 원장", reviewed_by: "forged-user", reviewed_at: "1999-01-01T00:00:00Z",
}, {
  id: "font:1", kind: "font", source_url: null, owner: "MemeCatch", acquisition_method: "self_created",
  allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null, valid_until: null,
  territories: ["worldwide"], evidence: "폰트 권리 원장", reviewed_by: "forged-user", reviewed_at: "1999-01-01T00:00:00Z",
}, {
  id: "graphic:1", kind: "graphic", source_url: null, owner: "MemeCatch", acquisition_method: "self_created",
  allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null, valid_until: null,
  territories: ["worldwide"], evidence: "그래픽 제작 원장", reviewed_by: "forged-user", reviewed_at: "1999-01-01T00:00:00Z",
}];
const candidate = {
  id: memeId, title: "테스트 밈", summary: "요약", description: "설명", origin: "기원",
  usage_note: null, caution: null, usage_examples: [],
  sources: [{ id: "source:one", title: "검수 출처", url: "https://example.com/source", approved: true }],
  claims: [{ id: "claim:one", type: "meaning", text: "확인된 뜻", source_id: "source:one" }],
};

function client(options: {
  auth?: { user?: { id: string } | null; error?: unknown };
  operator?: unknown;
  operatorError?: unknown;
  rpc?: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from?: (table: string) => unknown;
} = {}) {
  const extraRpc = options.rpc ?? (async () => ({ data: null, error: null }));
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.auth?.user === undefined ? { id: userId } : options.auth.user }, error: options.auth?.error ?? null }) },
    rpc: vi.fn((name: string, args?: Record<string, unknown>) => name === "is_operator"
      ? Promise.resolve({ data: options.operator === undefined ? true : options.operator, error: options.operatorError ?? null })
      : extraRpc(name, args)),
    from: vi.fn((table: string) => options.from?.(table)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("video production command authorization", () => {
  it("fails closed on auth errors before operator checks, providers, or database mutations", async () => {
    const supabase = client({ auth: { user: { id: userId }, error: { message: "auth unavailable" } } });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "generate", memeId })).resolves.toEqual({ ok: false, error: "로그인이 필요합니다." });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mocks.generateVideoDraft).not.toHaveBeenCalled();
  });

  it.each([{ operator: false, operatorError: null }, { operator: "true", operatorError: null }, { operator: true, operatorError: { message: "rpc failed" } }])(
    "requires an exact boolean operator result before all side effects: %o", async ({ operator, operatorError }) => {
      const supabase = client({ operator, operatorError });
      mocks.createClient.mockResolvedValue(supabase);
      await expect(performVideoProductionCommand({ kind: "generate", memeId })).resolves.toEqual({ ok: false, error: "운영자 권한이 필요합니다." });
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.from).not.toHaveBeenCalled();
      expect(mocks.generateVideoDraft).not.toHaveBeenCalled();
    },
  );
});

describe("video production command validation and ordering", () => {
  it("approves canonical render evidence even when the renderer records extra decode diagnostics", async () => {
    const single = vi.fn().mockResolvedValue({ data: {
      id: productionId, artifact_hash: hash, blocked_at: null, script_json: script, assets_json: assets,
      technical_check: { duration_ms: 36_000, width: 1080, height: 1920, has_audio: true,
        decodable: true, captions_safe: true, passed: true, decode_ok: true, audio_codec: "aac" },
    }, error: null });
    const supabase = client({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
      rpc: async () => ({ data: { id: productionId }, error: null }) });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "review", id: productionId, artifactHash: hash,
      decision: "approve", note: "실제 렌더 검사 확인" })).resolves.toEqual({ ok: true, id: productionId });
    expect(supabase.rpc).toHaveBeenCalledWith("review_video_production", expect.objectContaining({ p_decision: "approve" }));
  });

  it("requires literal consent, exact lowercase hashes, and a UUID channel before any upload lookup", async () => {
    for (const command of [
      { kind: "upload", id: productionId, artifactHash: hash, channelConnectionId, consent: false, madeForKids: false },
      { kind: "upload", id: productionId, artifactHash: "A".repeat(64), channelConnectionId, consent: true, madeForKids: false },
      { kind: "upload", id: productionId, artifactHash: hash, channelConnectionId: "UC-channel", consent: true, madeForKids: false },
    ]) {
      const supabase = client();
      mocks.createClient.mockResolvedValueOnce(supabase);
      await expect(performVideoProductionCommand(command as never)).resolves.toMatchObject({ ok: false });
      expect(supabase.from).not.toHaveBeenCalled();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a channel other than the configured immutable channel before queueing upload", async () => {
    const single = vi.fn().mockResolvedValue({ data: { channel_id: "UC-wrong" }, error: null });
    const supabase = client({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }) });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "upload", id: productionId, artifactHash: hash, channelConnectionId, consent: true, madeForKids: false }))
      .resolves.toEqual({ ok: false, error: "대상 YouTube 채널을 다시 연결해 주세요." });
    expect(supabase.rpc).not.toHaveBeenCalledWith("queue_youtube_publication", expect.anything());
  });

  it("reserves a generated draft before invoking the provider, then creates the ledger", async () => {
    const order: string[] = [];
    const supabase = client({ rpc: async (name) => {
      order.push(name);
      if (name === "reserve_video_production_draft") return { data: candidate, error: null };
      if (name === "create_video_production") return { data: { id: productionId }, error: null };
      throw new Error(`unexpected RPC ${name}`);
    } });
    mocks.generateVideoDraft.mockImplementation(async () => { order.push("provider"); return script; });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "generate", memeId })).resolves.toEqual({ ok: true, id: productionId });
    expect(order).toEqual(["reserve_video_production_draft", "provider", "create_video_production"]);
  });

  it("manual create parses grounded scripts strictly before reserving or creating", async () => {
    const invalid = { ...script, source_ids: ["source:unknown"] };
    const supabase = client({ rpc: async (name) => name === "get_video_production_candidates"
      ? { data: [candidate], error: null } : { data: { id: productionId }, error: null } });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "create", memeId, script: invalid, assets })).resolves.toMatchObject({ ok: false });
    expect(supabase.rpc).not.toHaveBeenCalledWith("reserve_video_production_draft", expect.anything());
    expect(supabase.rpc).not.toHaveBeenCalledWith("create_video_production", expect.anything());
    expect(mocks.generateVideoDraft).not.toHaveBeenCalled();
  });

  it("replaces forged asset reviewer metadata with the authenticated UID and current server time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T13:00:00Z"));
    const single = vi.fn().mockResolvedValue({ data: { source_snapshot: candidate }, error: null });
    const supabase = client({
      from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
      rpc: async (name) => name === "revise_video_production" ? { data: { id: productionId }, error: null } : { data: null, error: null },
    });
    mocks.createClient.mockResolvedValue(supabase);
    await expect(performVideoProductionCommand({ kind: "revise", id: productionId, expectedVersion: 1, script, assets })).resolves.toEqual({ ok: true, id: productionId });
    const call = supabase.rpc.mock.calls.find(([name]) => name === "revise_video_production");
    const reviewed = (call?.[1] as { p_assets_json: Array<{ reviewed_by: string; reviewed_at: string }> }).p_assets_json;
    expect(reviewed.every((asset) => asset.reviewed_by === userId && asset.reviewed_at === "2026-10-12T13:00:00.000Z")).toBe(true);
    expect(JSON.stringify(reviewed)).not.toContain("forged-user");
  });
});
