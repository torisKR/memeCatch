import type { VideoScript } from './core.mjs';

export interface VideoDraftSource { id: string; title: string; url: string; approved: true }
export interface VideoDraftClaim { id: string; type: string; text: string; source_id: string }
export interface VideoDraftCandidate {
  id: string; title: string; summary: string; description: string; origin: string;
  usage_note: string | null; caution: string | null; usage_examples: unknown;
  sources: VideoDraftSource[]; claims: VideoDraftClaim[];
}
export interface VideoDraftInput {
  untrusted_source_text: true;
  meme: { title: string; summary: string; description: string; usage_note: string | null; caution: string | null; usage_examples: unknown };
  reviewed_claims: Array<{ id: string; type: string; source_id: string; text: string }>;
  sources: Array<{ id: string; title: string; url: string; role: 'supporting_reference_not_reupload_permission' }>;
  constraints: { duration_ms: [number, number]; own_graphics_only: true; no_original_media_download: true; operator_review_required: true };
}
export const VIDEO_SCRIPT_SCHEMA: Readonly<Record<string, unknown>>;
export const VIDEO_DRAFT_INSTRUCTIONS: string;
export function buildVideoDraftInput(candidate: VideoDraftCandidate): VideoDraftInput;
export function loopbackOpenCodexEndpoint(value?: string): string;
export function requestOpenCodexDraft(input: VideoDraftInput, options: {
  allowedSourceIds: string[]; endpoint?: string; model: string; apiKey?: string;
  fetcher?: typeof fetch;
}): Promise<VideoScript>;
export function generateLocalVideoDraft(candidate: VideoDraftCandidate, options: {
  endpoint?: string; model: string; apiKey?: string; fetcher?: typeof fetch;
}): Promise<VideoScript>;
