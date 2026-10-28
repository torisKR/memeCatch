import "server-only";
import { parseVideoScript, type VideoScript } from "./core.mjs";
import type { VideoCandidate } from "./workspace-types";
import { VIDEO_SCRIPT_SCHEMA, VIDEO_DRAFT_INSTRUCTIONS, buildVideoDraftInput, requestOpenCodexDraft } from "./draft.mjs";
import { isOpenRouterConfigured, requestOpenRouterStructured, getMpeVisionModel,
  classifyOpenRouterReservationError } from "@/lib/mpe/openrouter.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export { VIDEO_SCRIPT_SCHEMA, buildVideoDraftInput } from "./draft.mjs";

export function videoDraftProviderConfigured(): boolean {
  return process.env.VIDEO_DRAFT_PROVIDER === "opencodex"
    ? process.env.NODE_ENV !== "production" && Boolean(process.env.OPENCODEX_CONTENT_MODEL?.trim())
    : isOpenRouterConfigured();
}

async function openCodexDraft(input: unknown): Promise<unknown> {
  if (process.env.NODE_ENV === "production") throw new Error("opencodex_development_only");
  const model = process.env.OPENCODEX_CONTENT_MODEL?.trim();
  if (!model) throw new Error("video_draft_provider_not_configured");
  return requestOpenCodexDraft(input as ReturnType<typeof buildVideoDraftInput>, { endpoint: process.env.OPENCODEX_CONTENT_BASE_URL, model,
    apiKey: process.env.OPENCODEX_CONTENT_API_KEY, allowedSourceIds: (input as ReturnType<typeof buildVideoDraftInput>).sources.map((source) => source.id) });
}

export async function generateVideoDraft(candidate: VideoCandidate, client: SupabaseClient): Promise<VideoScript> {
  if (!videoDraftProviderConfigured()) throw new Error("video_draft_provider_not_configured");
  const input = buildVideoDraftInput(candidate);
  const result = process.env.VIDEO_DRAFT_PROVIDER === "opencodex" ? await openCodexDraft(input)
    : await requestOpenRouterStructured<unknown>({ name: "memecatch_video_script", schema: VIDEO_SCRIPT_SCHEMA, instructions: VIDEO_DRAFT_INSTRUCTIONS,
      input: JSON.stringify(input), maxOutputTokens: 5000, reserveRequest: async () => {
        const { error } = await client.rpc("reserve_openrouter_daily_request", { p_provider: "openrouter", p_model: getMpeVisionModel() });
        if (error) throw new Error(classifyOpenRouterReservationError(error));
      } });
  return process.env.VIDEO_DRAFT_PROVIDER === "opencodex" ? result as VideoScript
    : parseVideoScript(result, { allowedSourceIds: candidate.sources.map((source) => source.id) });
}
