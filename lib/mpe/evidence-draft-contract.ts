import { z } from "zod";

const CLAIM_FIELDS = ["TITLE", "DEFINITION", "MEANING", "ORIGIN", "USAGE", "SAFETY"] as const;
const CLAIM_SUPPORT = ["direct", "partial", "unsupported", "abstained"] as const;

const claimSchema = z.object({
  field: z.enum(CLAIM_FIELDS),
  text: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  support: z.enum(CLAIM_SUPPORT).optional(),
  abstentionReason: z.string().trim().min(1).max(500).optional(),
}).strict();

export type MemeDraftClaim = z.infer<typeof claimSchema>;

export type DraftEvidence = {
  id: string;
  kind: "ingestion" | "source" | "text_segment";
  text: string;
  ingestionId?: string;
  sourceId?: string;
  textSegmentId?: string;
  origin?: string | null;
};

export const DRAFT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["claims"], properties: {
    claims: { type: "array", minItems: 1, items: {
      type: "object", additionalProperties: false,
      required: ["field", "text", "evidenceIds", "confidence", "needsReview"],
      properties: {
        field: { type: "string", enum: CLAIM_FIELDS }, text: { type: "string", minLength: 1 },
        evidenceIds: { type: "array", minItems: 0, items: { type: "string", minLength: 1 } },
        confidence: { type: "number", minimum: 0, maximum: 1 }, needsReview: { type: "boolean" },
        support: { type: "string", enum: CLAIM_SUPPORT }, abstentionReason: { type: "string", minLength: 1, maxLength: 500 },
      },
    } },
  },
} as const;

export function parseEvidenceDraftClaims(claims: unknown, evidence: readonly DraftEvidence[]): MemeDraftClaim[] {
  const parsed = z.array(claimSchema).min(1).safeParse(claims);
  if (!parsed.success) throw new Error("invalid_claim_schema");
  if (parsed.data.some((claim) => claim.evidenceIds.length === 0 && claim.support !== "unsupported" && claim.support !== "abstained")) {
    throw new Error("invalid_claim_schema");
  }
  const validEvidence = new Map(evidence.filter((item) => item.origin?.trim().toUpperCase() !== "STT")
    .filter((item) => item.text.trim()).map((item) => [item.id, item]));
  const supportedClaims = parsed.data.filter((claim) => claim.support !== "unsupported" && claim.support !== "abstained");
  if (supportedClaims.length === 0) throw new Error("no_supported_claims");
  for (const claim of supportedClaims) {
    if (claim.evidenceIds.length === 0 || claim.evidenceIds.some((id) => !validEvidence.has(id))
      || claim.evidenceIds.every((id) => validEvidence.get(id)?.kind === "ingestion")) throw new Error("invalid_claim_evidence");
  }
  return supportedClaims.map((claim) => ({ ...claim, needsReview: true }));
}

export function getAbstentionNotes(claims: unknown): Array<{ field: MemeDraftClaim["field"]; reason: string }> {
  if (!Array.isArray(claims)) return [];
  return claims.flatMap((claim) => {
    const parsed = claimSchema.safeParse(claim);
    return parsed.success && (parsed.data.support === "unsupported" || parsed.data.support === "abstained")
      ? [{ field: parsed.data.field, reason: parsed.data.abstentionReason ?? "근거 부족으로 사실 주장 생성을 보류함" }]
      : [];
  });
}
