import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestOpenRouterStructured: vi.fn(),
  isOpenRouterConfigured: vi.fn(() => false),
  getMpeVisionModel: vi.fn(() => "stealth/ox-alpha"),
  classifyOpenRouterReservationError: vi.fn(() => "openrouter_budget_reservation_failed"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mpe/openrouter.server", () => mocks);

import { buildVideoDraftInput, generateVideoDraft, videoDraftProviderConfigured } from "./draft.server";

const sources = [{ id: "source:one", title: "검수 출처", url: "https://example.com/source", approved: true as const }];
const candidate = {
  id: "20000000-0000-4000-8000-000000000002", title: "테스트 밈", summary: "요약", description: "설명", origin: "기원",
  usage_note: null, caution: null, usage_examples: [], sources,
  claims: [{ id: "claim:one", type: "meaning", text: "확인된 뜻", source_id: "source:one" }],
};

const scenes = [
  { id: "hook", kind: "hook", heading: "도입", caption: "표현을 살펴봅니다", narration: "표현을 먼저 살펴봅니다.", start_ms: 0, end_ms: 6_000, source_ids: ["source:one"] },
  { id: "meaning", kind: "meaning", heading: "뜻", caption: "검수된 뜻", narration: "검수된 뜻을 설명합니다.", start_ms: 6_000, end_ms: 13_000, source_ids: ["source:one"] },
  { id: "example", kind: "example", heading: "가상 상황", caption: "자체 작성 대화", narration: "자체 작성한 가상 상황입니다.", start_ms: 13_000, end_ms: 21_000, source_ids: [] },
  { id: "context", kind: "context", heading: "맥락", caption: "확인된 맥락", narration: "검수된 맥락을 설명합니다.", start_ms: 21_000, end_ms: 29_000, source_ids: ["source:one"] },
  { id: "caution", kind: "caution", heading: "주의", caption: "상황에 맞게 사용", narration: "상황에 맞게 풀어 말합니다.", start_ms: 29_000, end_ms: 36_000, source_ids: [] },
];
const generatedScript = {
  title: "테스트 밈", description: "검수된 근거와 자체 작성 가상 상황으로 사용 맥락을 설명합니다.",
  narration: scenes.map((scene) => scene.narration).join(" "),
  original_observation: "이 표현은 친근한 대화에서 상황을 짧게 압축하는 특징이 있습니다.",
  scenes, source_ids: ["source:one"], uncertain_claims: [],
  asset_requirements: [{ kind: "voice", description: "자체 음성" }, { kind: "font", description: "허가된 폰트" }, { kind: "graphic", description: "자체 그래픽" }],
  contains_synthetic_media: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.isOpenRouterConfigured.mockReturnValue(false);
});

describe("video draft evidence boundary", () => {
  it("marks external fields as untrusted data and sends only reviewed claim excerpts", () => {
    const input = buildVideoDraftInput({ ...candidate, claims: [{ ...candidate.claims[0], text: "x".repeat(2_500) }] });
    expect(input.untrusted_source_text).toBe(true);
    expect(input.reviewed_claims[0].text).toHaveLength(2_000);
    expect(input.sources[0].role).toBe("supporting_reference_not_reupload_permission");
    expect(input.constraints).toMatchObject({ own_graphics_only: true, no_original_media_download: true, operator_review_required: true });
  });

  it("accepts actual UUID source IDs emitted by the database snapshot", () => {
    const sourceId = "20000000-0000-4000-8000-000000000002";
    const input = buildVideoDraftInput({ ...candidate, sources: [{ ...sources[0], id: sourceId }],
      claims: [{ ...candidate.claims[0], source_id: sourceId }] });
    expect(input.sources[0].id).toBe(sourceId);
  });

  it("fails closed for non-source IDs, unapproved sources, and claims referring to unknown sources", () => {
    expect(() => buildVideoDraftInput({ ...candidate,
      sources: [{ ...sources[0], id: "record:description" }],
      claims: [{ ...candidate.claims[0], source_id: "record:description" }],
    })).toThrow(/reviewed_evidence_required/);
    expect(() => buildVideoDraftInput({ ...candidate, sources: [{ ...sources[0], approved: false as true }] })).toThrow(/reviewed_evidence_required/);
    expect(() => buildVideoDraftInput({ ...candidate, claims: [{ ...candidate.claims[0], source_id: "source:unknown" }] })).toThrow(/reviewed_evidence_required/);
    expect(() => buildVideoDraftInput({ ...candidate, sources: [...sources, { ...sources[0], id: "source:two", approved: false as true }] })).toThrow(/reviewed_evidence_required/);
  });

  it("bounds list, field and total payload sizes before any provider call", () => {
    expect(() => buildVideoDraftInput({ ...candidate, description: "x".repeat(12001) })).toThrow(/video_draft_input_too_large/);
    expect(() => buildVideoDraftInput({ ...candidate, claims: Array.from({ length: 21 }, () => candidate.claims[0]) })).toThrow(/video_draft_input_too_large/);
    expect(() => buildVideoDraftInput({ ...candidate, claims: Array.from({ length: 20 }, () => ({ ...candidate.claims[0], text: "x".repeat(2000) })) })).toThrow(/video_draft_input_too_large/);
    const input = buildVideoDraftInput({ ...candidate, claims: [{ ...candidate.claims[0], extraSecret: "never returned" } as typeof candidate.claims[number]] });
    expect(input.reviewed_claims[0]).not.toHaveProperty("extraSecret");
  });
});

describe("video draft provider boundaries", () => {
  it("allows OpenCodex only on a local development endpoint", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIDEO_DRAFT_PROVIDER", "opencodex");
    vi.stubEnv("OPENCODEX_CONTENT_MODEL", "gpt-local");
    vi.stubEnv("OPENCODEX_CONTENT_BASE_URL", "http://localhost:10100/v1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generatedScript) } }] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    const client = { rpc: vi.fn() } as never;
    await expect(generateVideoDraft(candidate, client)).resolves.toMatchObject({ title: "테스트 밈" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:10100/v1/chat/completions", expect.objectContaining({ method: "POST", redirect: "error" }));
    fetchMock.mockRestore();
  });

  it("rejects remote or credential-bearing OpenCodex endpoints and all production OpenCodex use", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIDEO_DRAFT_PROVIDER", "opencodex");
    vi.stubEnv("OPENCODEX_CONTENT_MODEL", "gpt-local");
    vi.stubEnv("OPENCODEX_CONTENT_BASE_URL", "https://remote.example/v1");
    const client = { rpc: vi.fn() } as never;
    await expect(generateVideoDraft(candidate, client)).rejects.toThrow(/invalid_opencodex_endpoint/);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENCODEX_CONTENT_BASE_URL", "http://localhost:10100/v1");
    expect(videoDraftProviderConfigured()).toBe(false);
    await expect(generateVideoDraft(candidate, client)).rejects.toThrow(/video_draft_provider_not_configured/);
  });
});
