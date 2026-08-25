import "server-only";

import { z } from "zod";
import {
  isOpenRouterConfigured,
  requestOpenRouterStructured,
} from "@/lib/mpe/openrouter.server";
import { createClient } from "@/lib/supabase/server";

type MpeClient = Awaited<ReturnType<typeof createClient>>;

const CLAIM_FIELDS = ["TITLE", "DEFINITION", "MEANING", "ORIGIN", "USAGE", "SAFETY"] as const;
const claimSchema = z.object({
  field: z.enum(CLAIM_FIELDS),
  text: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
}).strict();

export type MemeDraftClaim = z.infer<typeof claimSchema>;

export type DraftEvidence = {
  id: string;
  kind: "ingestion" | "source" | "text_segment";
  text: string;
  ingestionId?: string;
  sourceId?: string;
  textSegmentId?: string;
};

type DirectUploadIngestion = {
  id: string;
  ingest_mode: string;
  mime_type: string;
  sha256: string;
  rights_attested_at: string;
};

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "text", "evidenceIds", "confidence", "needsReview"],
        properties: {
          field: { type: "string", enum: CLAIM_FIELDS },
          text: { type: "string", minLength: 1 },
          evidenceIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          needsReview: { type: "boolean" },
        },
      },
    },
  },
} as const;

export class EvidenceDraftError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "EvidenceDraftError";
  }
}

export function validateEvidenceDraft(claims: unknown, evidence: DraftEvidence[]): MemeDraftClaim[] {
  const parsed = z.array(claimSchema).min(1).safeParse(claims);
  if (!parsed.success) throw new EvidenceDraftError("invalid_claim_schema", 422);
  const validEvidence = new Map(evidence.filter((item) => item.text.trim()).map((item) => [item.id, item]));
  for (const claim of parsed.data) {
    if (claim.evidenceIds.some((id) => !validEvidence.has(id))
      || claim.evidenceIds.every((id) => validEvidence.get(id)?.kind === "ingestion")) {
      throw new EvidenceDraftError("invalid_claim_evidence", 422);
    }
  }
  return parsed.data;
}

export function buildDirectUploadEvidence(ingestion: DirectUploadIngestion): DraftEvidence | null {
  if (ingestion.ingest_mode !== "USER_UPLOADED" || !ingestion.rights_attested_at) return null;
  return {
    id: ingestion.id,
    kind: "ingestion",
    ingestionId: ingestion.id,
    text: [
      `MIME: ${ingestion.mime_type}`,
      `SHA-256: ${ingestion.sha256}`,
      `권리 모드: ${ingestion.ingest_mode}`,
      `권리 확인 시각: ${ingestion.rights_attested_at}`,
    ].join(" | "),
  };
}

export function ensureEvidenceDraftProvider(): void {
  if (!isOpenRouterConfigured()) {
    throw new EvidenceDraftError("draft_provider_not_configured", 503);
  }
}

export function prioritizeDraftEvidence(evidence: DraftEvidence[]): DraftEvidence[] {
  return [...evidence].sort((left, right) => Number(left.kind === "ingestion") - Number(right.kind === "ingestion"));
}

async function requireOperator(client: MpeClient) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new EvidenceDraftError("signed_out", 401);
  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "operator") throw new EvidenceDraftError("operator_required", 403);
  return user;
}

export async function generateEvidenceDraft(candidateId: string, providedClient?: MpeClient) {
  const client = providedClient ?? await createClient();
  await requireOperator(client);
  ensureEvidenceDraftProvider();
  const { data: candidate, error: candidateError } = await client
    .from("meme_candidates")
    .select("id, ingestion_id, title")
    .eq("id", candidateId)
    .single();
  if (candidateError || !candidate) throw new EvidenceDraftError("candidate_not_found", 404);

  const { data: ingestion, error: ingestionError } = await client
    .from("media_ingestions")
    .select("id, source_id, ingest_mode, mime_type, sha256, rights_attested_at")
    .eq("id", candidate.ingestion_id)
    .single();
  if (ingestionError || !ingestion) throw new EvidenceDraftError("ingestion_not_found", 404);
  const [{ data: source, error: sourceError }, { data: segments, error: segmentError }] = await Promise.all([
    ingestion.source_id
      ? client.from("media_sources").select("id, platform, canonical_url, channel_name, title").eq("id", ingestion.source_id).single()
      : Promise.resolve({ data: null, error: null }),
    client.from("text_segments").select("id, raw_text, normalized_text").eq("ingestion_id", candidate.ingestion_id),
  ]);
  if (sourceError) throw new EvidenceDraftError("source_not_found", 404);
  if (segmentError) throw new EvidenceDraftError(`evidence_load_failed: ${segmentError.message}`);

  const evidence = prioritizeDraftEvidence([
    ...(source ? [{
      id: source.id,
      kind: "source" as const,
      sourceId: source.id,
      text: [source.platform, source.title, source.channel_name, source.canonical_url].filter(Boolean).join(" | "),
    }] : []),
    ...(segments ?? []).map((segment) => ({
      id: segment.id,
      kind: "text_segment" as const,
      textSegmentId: segment.id,
      text: segment.normalized_text || segment.raw_text,
    })),
    ...([buildDirectUploadEvidence(ingestion)].filter((item): item is DraftEvidence => item !== null)),
  ]);

  const claims = validateEvidenceDraft((await requestOpenRouterStructured<{ claims?: unknown }>({
      name: "mpe_evidence_draft",
      schema: DRAFT_SCHEMA,
      instructions: [
        "Create Korean MemeCatch draft claims using only the supplied evidence.",
        "Every claim must cite one or more exact evidence IDs from the input.",
        "A source or text_segment evidence ID is required; ingestion metadata alone cannot support a claim.",
        "Never decide copyright, identity, safety, publication, or original-source certainty.",
        "Set needsReview true when the evidence does not directly prove the wording.",
      ].join(" "),
      input: JSON.stringify({ title: candidate.title, evidence }),
      maxOutputTokens: 4096,
    })).claims, evidence);

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const rows = claims.flatMap((claim) => claim.evidenceIds.map((evidenceId) => {
    const item = evidenceById.get(evidenceId)!;
    return {
      claim_field: claim.field,
      claim_text: claim.text,
      ingestion_id: item.ingestionId ?? null,
      source_id: item.sourceId ?? null,
      text_segment_id: item.textSegmentId ?? null,
      confidence: claim.confidence,
      review_status: "PENDING",
    };
  }));
  const { error: replaceError } = await client.rpc("replace_mpe_candidate_evidence", {
    p_candidate_id: candidateId,
    p_draft_json: { claims },
    p_evidence: rows,
  });
  if (replaceError) throw new EvidenceDraftError(`draft_replace_failed: ${replaceError.message}`);
  return { mode: "ai" as const, claims };
}
