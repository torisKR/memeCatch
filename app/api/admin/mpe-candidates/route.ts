import { z } from "zod";
import {
  createCandidateFromIngestion,
  discardCreatedCandidate,
  generateCandidateMatches,
  listCandidateMatches,
  MpeCandidateError,
} from "@/lib/mpe/candidates.server";
import {
  EvidenceDraftError,
  generateEvidenceDraft,
} from "@/lib/mpe/evidence-draft.server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/origin";

const candidateIdSchema = z.uuid();
const postSchema = z.union([
  z.object({
    action: z.literal("create"),
    ingestionId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    memeType: z.enum([
      "PHRASE", "REACTION_IMAGE", "VIDEO_SCENE", "SOUND", "CHALLENGE",
      "IMAGE_TEMPLATE", "CHARACTER", "EVENT_RECORD", "OTHER",
    ]),
  }),
  z.object({
    candidateId: z.uuid(),
    action: z.enum(["matches", "evidence_draft"]).default("matches"),
  }),
]);

async function operatorClient() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false as const, response: Response.json({ ok: false, error: "signed_out" }, { status: 401 }) };
  const { data: isOperator } = await client.rpc("is_operator");
  if (!isOperator) {
    return { ok: false as const, response: Response.json({ ok: false, error: "operator_required" }, { status: 403 }) };
  }
  return { ok: true as const, client };
}

function errorResponse(error: unknown) {
  if (error instanceof MpeCandidateError || error instanceof EvidenceDraftError) {
    return Response.json({ ok: false, error: error.message }, { status: error.status });
  }
  return Response.json({ ok: false, error: "mpe_candidate_failed" }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await operatorClient();
  if (!auth.ok) return auth.response;
  const parsed = candidateIdSchema.safeParse(new URL(request.url).searchParams.get("candidateId"));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  try {
    return Response.json(
      { ok: true, data: await listCandidateMatches(parsed.data, auth.client) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const auth = await operatorClient();
  if (!auth.ok) return auth.response;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  try {
    if (parsed.data.action === "create") {
      const created = await createCandidateFromIngestion({
        ingestionId: parsed.data.ingestionId,
        title: parsed.data.title,
        memeType: parsed.data.memeType,
      }, auth.client);
      const candidateId = created.candidate.id;
      try {
        const matches = await generateCandidateMatches(candidateId, auth.client);
        const draft = await generateEvidenceDraft(candidateId, auth.client);
        return Response.json(
          { ok: true, data: { ...created, matches, draft } },
          { headers: { "cache-control": "no-store" } },
        );
      } catch (error) {
        if (created.created) await discardCreatedCandidate(candidateId, auth.client);
        throw error;
      }
    }
    const data = parsed.data.action === "matches"
      ? await generateCandidateMatches(parsed.data.candidateId, auth.client)
      : await generateEvidenceDraft(parsed.data.candidateId, auth.client);
    return Response.json({ ok: true, data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
