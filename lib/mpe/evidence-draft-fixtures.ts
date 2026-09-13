import type { DraftEvidence } from "./evidence-draft.server";

type EvidenceDraftFixture = {
  readonly id: string;
  readonly evidence: DraftEvidence[];
  readonly claims: unknown;
  readonly expected: "accepted" | "reject";
  readonly requiresReview: boolean;
};

const segment = (id: string, text: string): DraftEvidence => ({
  id,
  kind: "text_segment",
  textSegmentId: id,
  text,
  origin: "OCR",
});

export const EVIDENCE_DRAFT_FIXTURES: readonly EvidenceDraftFixture[] = [
  {
    id: "definition-direct-ocr",
    evidence: [segment("definition", "퇴근하고 싶다")],
    claims: [{ field: "DEFINITION", text: "퇴근하고 싶다", evidenceIds: ["definition"], confidence: 0.8, needsReview: false }],
    expected: "accepted",
    requiresReview: true,
  },
  {
    id: "origin-date-needs-human-review",
    evidence: [segment("metadata", "업로드일 2018")],
    claims: [{ field: "ORIGIN", text: "최초 유래는 2018년이다", evidenceIds: ["metadata"], confidence: 0.9, needsReview: false }],
    expected: "accepted",
    requiresReview: true,
  },
  {
    id: "missing-evidence",
    evidence: [segment("present", "화면 문구")],
    claims: [{ field: "MEANING", text: "설명", evidenceIds: ["missing"], confidence: 0.8, needsReview: true }],
    expected: "reject",
    requiresReview: true,
  },
  {
    id: "stt-only-legacy",
    evidence: [{ ...segment("legacy-stt", "구형 전사"), origin: "STT" }],
    claims: [{ field: "MEANING", text: "뜻", evidenceIds: ["legacy-stt"], confidence: 0.8, needsReview: true }],
    expected: "reject",
    requiresReview: true,
  },
  {
    id: "ingestion-only",
    evidence: [{ id: "upload", kind: "ingestion", ingestionId: "upload", text: "MIME: image/png" }],
    claims: [{ field: "TITLE", text: "업로드 밈", evidenceIds: ["upload"], confidence: 0.8, needsReview: true }],
    expected: "reject",
    requiresReview: true,
  },
];
