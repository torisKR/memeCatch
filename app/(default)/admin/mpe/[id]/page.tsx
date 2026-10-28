import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { MpeReviewConsole, type MpeReviewConsoleProps, type MpeReviewStatus } from "@/components/admin/mpe-review-console";
import type { Json } from "@/lib/database.types";
import { MPE_STORAGE_BUCKET } from "@/lib/mpe/storage.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "MPE 후보 검수" };
export const dynamic = "force-dynamic";

type DetailRow = {
  id: string;
  ingestion_id: string;
  title: string;
  meme_type: string;
  review_status: MpeReviewStatus;
  overall_confidence: number | null;
  draft_json: Json;
  model_version: string;
  prompt_version: string;
  media_ingestions: {
    id: string;
    user_id: string;
    source_id: string | null;
    ingest_mode: string;
    mime_type: string;
    width: number | null;
    height: number | null;
    duration_ms: number | null;
    rights_attested_at: string | null;
    source_role: MpeReviewConsoleProps["media"]["sourceRole"];
    rights_basis: MpeReviewConsoleProps["media"]["rightsBasis"];
    media_sources: {
      canonical_url: string;
      title: string | null;
      channel_name: string | null;
      platform_published_at: string | null;
      public_status: string | null;
    } | null;
  } | null;
};

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  processor_name: string;
  processor_version: string;
  output_json: Json;
  error_code: string | null;
};

type SegmentRow = {
  id: string;
  origin: string;
  start_ms: number | null;
  end_ms: number | null;
  raw_text: string;
  normalized_text: string | null;
  confidence: number | null;
};

type FingerprintRow = {
  id: string;
  fingerprint_type: string;
  hash_value: string;
  frame_ms: number | null;
};

type MatchRow = {
  id: string;
  rank: number;
  overall_score: number;
  classification: "DUPLICATE" | "RELATED" | "DERIVED" | "SEPARATE";
  memes: { title: string } | null;
};

type ClaimRow = {
  id: string;
  claim_field: string;
  claim_text: string;
  confidence: number | null;
  review_status: string;
  media_sources: { canonical_url: string } | null;
  text_segments: { id: string; origin: string; start_ms: number | null; raw_text: string } | null;
};

type RevisionRow = {
  id: string;
  revision_number: number;
  draft_json: Json;
  model_version: string;
  prompt_version: string;
  created_at: string;
};

function objectJson(value: Json): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value;
}

type UnsignedArtifact = MpeReviewConsoleProps["artifacts"][number] & { storageKey: string | null };

function artifactsFromJobs(jobs: JobRow[]): UnsignedArtifact[] {
  const artifacts: UnsignedArtifact[] = [];
  for (const job of jobs) {
    if (job.status !== "completed") continue;
    const output = objectJson(job.output_json);
    const rows = Array.isArray(output.artifacts) ? output.artifacts : [];
    for (const [index, value] of rows.entries()) {
      if (!value || Array.isArray(value) || typeof value !== "object") continue;
      const storageKey = typeof value.storageKey === "string" ? value.storageKey : null;
      const kind = typeof value.kind === "string" ? value.kind : job.job_type;
      if (!storageKey || !["representative_frame", "scene_frame"].includes(kind)) continue;
      artifacts.push({
        id: `${job.id}:${index}`,
        kind,
        frameMs: typeof value.frameMs === "number" ? value.frameMs : null,
        reference: "프레임 서명 URL을 만들지 못했어요.",
        representative: kind === "representative_frame" || value.representative === true,
        signedUrl: null,
        mimeType: typeof value.mimeType === "string" ? value.mimeType : null,
        storageKey,
      });
    }
  }
  return artifacts;
}

async function signFrameArtifacts(
  artifacts: UnsignedArtifact[],
  userId: string,
  ingestionId: string,
): Promise<MpeReviewConsoleProps["artifacts"]> {
  const prefix = `${userId}/${ingestionId}/frames/`;
  const storage = createAdminClient().storage.from(MPE_STORAGE_BUCKET);
  return Promise.all(artifacts.map(async ({ storageKey, ...artifact }) => {
    if (!storageKey?.startsWith(prefix) || !/^\d{3}\.jpg$/.test(storageKey.slice(prefix.length))) {
      return artifact;
    }
    const { data, error } = await storage.createSignedUrl(storageKey, 60);
    return { ...artifact, signedUrl: error ? null : data?.signedUrl ?? null };
  }));
}

export default async function AdminMpeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOperatorPage(`/admin/mpe/${id}`);
  const { data: candidate, error } = await supabase
    .from("meme_candidates")
    .select("id, ingestion_id, title, meme_type, review_status, overall_confidence, draft_json, model_version, prompt_version, media_ingestions(id, user_id, source_id, ingest_mode, mime_type, width, height, duration_ms, rights_attested_at, source_role, rights_basis, media_sources(canonical_url, title, channel_name, platform_published_at, public_status))")
    .eq("id", id)
    .single<DetailRow>();
  if (error || !candidate?.media_ingestions) notFound();

  const ingestion = candidate.media_ingestions;
  const [jobsResult, segmentsResult, fingerprintsResult, matchesResult, claimsResult, revisionsResult] = await Promise.all([
    supabase.from("processing_jobs").select("id, job_type, status, attempts, processor_name, processor_version, output_json, error_code").eq("ingestion_id", ingestion.id).order("created_at").returns<JobRow[]>(),
    supabase.from("text_segments").select("id, origin, start_ms, end_ms, raw_text, normalized_text, confidence").eq("ingestion_id", ingestion.id).order("start_ms", { ascending: true, nullsFirst: true }).order("id").returns<SegmentRow[]>(),
    supabase.from("media_fingerprints").select("id, fingerprint_type, hash_value, frame_ms").eq("ingestion_id", ingestion.id).order("frame_ms", { ascending: true, nullsFirst: false }).returns<FingerprintRow[]>(),
    supabase.from("candidate_matches").select("id, rank, overall_score, classification, memes(title)").eq("candidate_id", candidate.id).neq("classification", "SEPARATE").order("rank").limit(5).returns<MatchRow[]>(),
    supabase.from("claim_evidence").select("id, claim_field, claim_text, confidence, review_status, media_sources(canonical_url), text_segments(id, origin, start_ms, raw_text)").eq("candidate_id", candidate.id).order("created_at").returns<ClaimRow[]>(),
    supabase.from("candidate_revisions").select("id, revision_number, draft_json, model_version, prompt_version, created_at").eq("candidate_id", candidate.id).order("revision_number", { ascending: false }).limit(5).returns<RevisionRow[]>(),
  ]);
  const firstError = [jobsResult.error, segmentsResult.error, fingerprintsResult.error, matchesResult.error, claimsResult.error, revisionsResult.error].find(Boolean);
  if (firstError) throw new Error(`MPE 검수 자료를 불러오지 못했어요: ${firstError.message}`);

  const { data: queueRows, error: queueError } = await supabase
    .from("meme_candidates")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<Array<{ id: string }>>();
  if (queueError) throw new Error(`MPE 검수 큐 순서를 불러오지 못했어요: ${queueError.message}`);
  const queueIds = (queueRows ?? []).map((row) => row.id);
  const queueIndex = queueIds.indexOf(candidate.id);
  const queue = {
    previousId: queueIndex > 0 ? queueIds[queueIndex - 1] : null,
    nextId: queueIndex >= 0 && queueIndex < queueIds.length - 1 ? queueIds[queueIndex + 1] : null,
  };

  const jobs = jobsResult.data ?? [];
  const artifacts = await signFrameArtifacts(artifactsFromJobs(jobs), ingestion.user_id, ingestion.id);
  for (const fingerprint of fingerprintsResult.data ?? []) {
    if (fingerprint.frame_ms === null) continue;
    artifacts.push({
      id: fingerprint.id,
      kind: fingerprint.fingerprint_type,
      frameMs: fingerprint.frame_ms,
      reference: `fingerprint:${fingerprint.hash_value.slice(0, 16)}`,
      representative: false,
      signedUrl: null,
      mimeType: null,
    });
  }

  const props: MpeReviewConsoleProps = {
    candidate: {
      id: candidate.id,
      title: candidate.title,
      memeType: candidate.meme_type,
      reviewStatus: candidate.review_status,
      overallConfidence: candidate.overall_confidence,
      draft: objectJson(candidate.draft_json),
      modelVersion: candidate.model_version,
      promptVersion: candidate.prompt_version,
    },
    media: {
      ingestionId: ingestion.id,
      sourceUrl: ingestion.media_sources?.canonical_url ?? null,
      sourceTitle: ingestion.media_sources?.title ?? null,
      authorName: ingestion.media_sources?.channel_name ?? null,
      publishedAt: ingestion.media_sources?.platform_published_at ?? null,
      availabilityStatus: ingestion.media_sources?.public_status ?? null,
      rightsMode: ingestion.ingest_mode,
      rightsAttested: Boolean(ingestion.rights_attested_at),
      sourceRole: ingestion.source_role,
      rightsBasis: ingestion.rights_basis,
      mimeType: ingestion.mime_type,
      dimensions: ingestion.width && ingestion.height ? `${ingestion.width}×${ingestion.height}` : null,
      durationMs: ingestion.duration_ms,
    },
    jobs: jobs.map((job) => ({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      attempts: job.attempts,
      processor: [job.processor_name, job.processor_version].filter(Boolean).join(":") || null,
      errorCode: job.error_code,
      canReprocess: ["failed", "skipped", "completed"].includes(job.status),
    })),
    timeline: (segmentsResult.data ?? []).map((segment) => ({
      id: segment.id,
      origin: segment.origin,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      text: segment.normalized_text || segment.raw_text,
      confidence: segment.confidence,
    })),
    artifacts,
    matches: (matchesResult.data ?? []).map((match) => ({
      id: match.id,
      targetTitle: match.memes?.title ?? "삭제된 밈",
      relation: match.classification as "DUPLICATE" | "RELATED" | "DERIVED",
      score: match.overall_score,
    })),
    claims: (claimsResult.data ?? []).map((claim) => ({
      id: claim.id,
      field: claim.claim_field,
      text: claim.claim_text,
      confidence: claim.confidence ?? 0,
      reviewStatus: claim.review_status,
      evidence: [
        claim.text_segments
          ? {
              kind: "text_segment" as const,
              segmentId: claim.text_segments.id,
              origin: claim.text_segments.origin,
              startMs: claim.text_segments.start_ms,
              text: claim.text_segments.raw_text,
              url: null,
            }
          : null,
        claim.media_sources?.canonical_url
          ? {
              kind: "source" as const,
              segmentId: null,
              origin: null,
              startMs: null,
              text: claim.media_sources.canonical_url,
              url: claim.media_sources.canonical_url,
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    })),
    revisions: (revisionsResult.data ?? []).map((revision) => ({
      id: revision.id,
      revisionNumber: revision.revision_number,
      draft: objectJson(revision.draft_json),
      modelVersion: revision.model_version,
      promptVersion: revision.prompt_version,
      createdAt: revision.created_at,
    })),
    queue,
  };

  return (
    <div className="space-y-6">
      <MpeReviewConsole {...props} />
    </div>
  );
}
