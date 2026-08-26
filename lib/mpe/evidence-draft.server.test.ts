import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  buildDirectUploadEvidence,
  ensureEvidenceDraftProvider,
  prioritizeDraftEvidence,
  generateEvidenceDraft,
  validateEvidenceDraft,
  withoutSttDraftEvidence,
} from "./evidence-draft.server";

const evidence = [{
  id: "segment-1",
  kind: "text_segment" as const,
  textSegmentId: "segment-1",
  text: "퇴근하고 싶다",
}];

describe("MPE evidence draft", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("blocks draft generation when the structured provider is not configured", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(() => ensureEvidenceDraftProvider()).toThrowError(expect.objectContaining({
      message: "draft_provider_not_configured",
      status: 503,
    }));

    vi.stubEnv("OPENROUTER_API_KEY", "router-key");
    expect(() => ensureEvidenceDraftProvider()).not.toThrow();
  });

  it("rejects missing, empty, and unknown evidence IDs before persistence", () => {
    expect(() => validateEvidenceDraft([{ field: "TITLE", text: "제목", evidenceIds: [], confidence: 0.5, needsReview: true }], evidence))
      .toThrow("invalid_claim_schema");
    expect(() => validateEvidenceDraft([{ field: "TITLE", text: "제목", evidenceIds: ["unknown"], confidence: 0.5, needsReview: true }], evidence))
      .toThrow("invalid_claim_evidence");
    expect(() => validateEvidenceDraft([{ field: "TITLE", text: "제목", evidenceIds: ["empty"], confidence: 0.5, needsReview: true }], [
      { id: "empty", kind: "source", sourceId: "empty", text: "   " },
    ])).toThrow("invalid_claim_evidence");
  });

  it("places visual text evidence before ingestion metadata for provider citation", () => {
    const ingestion = {
      id: "ingestion-1",
      kind: "ingestion" as const,
      ingestionId: "ingestion-1",
      text: "MIME: image/jpeg | SHA-256: abc",
    };
    const ordered = prioritizeDraftEvidence([ingestion, ...evidence]);

    expect(ordered.map((item) => item.kind)).toEqual(["text_segment", "ingestion"]);
    expect(() => validateEvidenceDraft([{
      field: "DEFINITION",
      text: "로컬 OCR 문구",
      evidenceIds: [ordered[0].id],
      confidence: 0.9,
      needsReview: true,
    }], ordered)).not.toThrow();
  });

  it("excludes and rejects legacy STT evidence before provider input or persistence", () => {
    const legacy = { id: "qwen-segment", kind: "text_segment" as const, text: "구형 Qwen 전사", origin: "STT" };
    expect(withoutSttDraftEvidence([...evidence, legacy])).toEqual(evidence);
    expect(() => validateEvidenceDraft([{
      field: "DEFINITION",
      text: "구형 전사 기반 주장",
      evidenceIds: [legacy.id],
      confidence: 0.9,
      needsReview: true,
    }], [legacy])).toThrow("invalid_claim_evidence");
  });

  it("does not turn MIME or SHA metadata into an arbitrary title claim", () => {
    const uploadEvidence = buildDirectUploadEvidence({
      id: "ingestion-1",
      ingest_mode: "USER_UPLOADED",
      mime_type: "image/png",
      sha256: "a".repeat(64),
      rights_attested_at: "2026-08-24T12:00:00.000Z",
    });

    expect(uploadEvidence).toMatchObject({
      id: "ingestion-1",
      kind: "ingestion",
      ingestionId: "ingestion-1",
    });
    expect(uploadEvidence?.text).toContain("MIME: image/png");
    expect(uploadEvidence?.text).toContain(`SHA-256: ${"a".repeat(64)}`);
    if (!uploadEvidence) throw new Error("direct upload evidence expected");
    expect(() => validateEvidenceDraft([{
      field: "TITLE",
      text: "직접 업로드 밈",
      evidenceIds: ["ingestion-1"],
      confidence: 0.55,
      needsReview: true,
    }], [uploadEvidence])).toThrow("invalid_claim_evidence");
  });

  it("reserves the OpenRouter daily budget through the operator client before drafting", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "router-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ claims: [{
        field: "TITLE",
        text: "화면 문구 밈",
        evidenceIds: ["segment-1"],
        confidence: 0.9,
        needsReview: true,
      }] }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "operator-1" } } }) },
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          single: async () => {
            if (table === "profiles") return { data: { role: "operator" }, error: null };
            if (table === "meme_candidates") return { data: { id: "candidate-1", ingestion_id: "ingestion-1", title: "초안" }, error: null };
            if (table === "media_ingestions") return { data: {
              id: "ingestion-1", source_id: null, ingest_mode: "USER_UPLOADED", mime_type: "image/png",
              sha256: "a".repeat(64), rights_attested_at: "2026-08-26T00:00:00.000Z",
            }, error: null };
            return { data: null, error: null };
          },
          then: (resolve: (value: unknown) => unknown) => resolve(table === "text_segments"
            ? { data: [{ id: "segment-1", raw_text: "화면 문구", normalized_text: "화면 문구", origin: "OCR" }], error: null }
            : { data: null, error: null }),
        };
        return query;
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        return { data: {}, error: null };
      },
    };

    await expect(generateEvidenceDraft("candidate-1", client as never)).resolves.toMatchObject({ mode: "ai" });
    expect(rpcCalls[0]).toEqual([
      "reserve_openrouter_daily_request",
      { p_provider: "openrouter", p_model: "stealth/ox-alpha" },
    ]);
    expect(rpcCalls[1]?.[0]).toBe("replace_mpe_candidate_evidence");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it.each([
    [{ details: "openrouter_daily_budget_exhausted" }, "openrouter_daily_budget_exhausted", 429],
    [{ code: "42501", message: "operator_required" }, "openrouter_budget_reservation_failed", 503],
  ])("surfaces reservation failures as explicit API errors without provider fetch", async (rpcError, message, status) => {
    vi.stubEnv("OPENROUTER_API_KEY", "router-key");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "operator-1" } } }) },
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          neq: () => query,
          single: async () => {
            if (table === "profiles") return { data: { role: "operator" }, error: null };
            if (table === "meme_candidates") return { data: { id: "candidate-1", ingestion_id: "ingestion-1", title: "초안" }, error: null };
            if (table === "media_ingestions") return { data: {
              id: "ingestion-1", source_id: null, ingest_mode: "USER_UPLOADED", mime_type: "image/png",
              sha256: "a".repeat(64), rights_attested_at: "2026-08-26T00:00:00.000Z",
            }, error: null };
            return { data: null, error: null };
          },
          then: (resolve: (value: unknown) => unknown) => resolve(table === "text_segments"
            ? { data: [{ id: "segment-1", raw_text: "화면 문구", normalized_text: "화면 문구", origin: "OCR" }], error: null }
            : { data: null, error: null }),
        };
        return query;
      },
      rpc: async (name: string) => name === "reserve_openrouter_daily_request"
        ? { data: null, error: rpcError }
        : { data: {}, error: null },
    };

    await expect(generateEvidenceDraft("candidate-1", client as never)).rejects.toMatchObject({ message, status });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
