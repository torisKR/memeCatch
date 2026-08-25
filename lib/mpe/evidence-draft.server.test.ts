import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  buildDirectUploadEvidence,
  ensureEvidenceDraftProvider,
  prioritizeDraftEvidence,
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
  afterEach(() => vi.unstubAllEnvs());

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
});
