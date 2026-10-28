export type VideoSceneKind = 'hook' | 'meaning' | 'example' | 'context' | 'caution';
export type VideoAssetKind = 'graphic' | 'voice' | 'font' | 'image' | 'video' | 'music';
export type AcquisitionMethod = 'self_created' | 'creator_supplied' | 'licensed';

export interface VideoScene {
  id: string;
  kind: VideoSceneKind;
  heading: string;
  caption: string;
  narration: string;
  start_ms: number;
  end_ms: number;
  source_ids: readonly string[];
}

export interface VideoScript {
  title: string;
  description: string;
  narration: string;
  original_observation: string;
  scenes: readonly VideoScene[];
  source_ids: readonly string[];
  uncertain_claims: readonly { text: string; reason: string }[];
  asset_requirements: readonly { kind: VideoAssetKind; description: string }[];
  contains_synthetic_media: boolean;
}

export interface RightsAsset {
  id: string;
  kind: VideoAssetKind;
  source_url: string | null;
  owner: string;
  acquisition_method: AcquisitionMethod;
  allow_edit: boolean;
  allow_youtube: boolean;
  allow_commercial: boolean;
  attribution: string | null;
  valid_until: string | null;
  territories: readonly string[];
  evidence: string;
  reviewed_by: string;
  reviewed_at: string;
}

export interface DailyLimits { candidate: number; draft: number; publish: number }
export const DEFAULT_DAILY_LIMITS: Readonly<DailyLimits>;
export function publicAttributionUrl(value: unknown): string;

export function parseVideoScript(value: unknown, options?: { allowedSourceIds?: readonly string[] | ReadonlySet<string> }): Readonly<VideoScript>;
export function evaluateAssetRights(assets: unknown, now?: Date | string | number): Readonly<{ allowed: boolean; reasons: readonly string[] }>;
export function productionReadiness(input: {
  script: unknown;
  assets: unknown;
  blocked: boolean;
  artifactHash: string;
  approvedArtifactHash: string;
  technicalCheck: { duration_ms: number; width: number; height: number; has_audio: boolean; decodable: boolean; captions_safe: boolean; passed?: boolean };
}, now?: Date | string | number): Readonly<{ ready: boolean; reasons: readonly string[] }>;
export function publicationEligibility(input: {
  channel: string;
  uploadedChannel: string;
  hash: { artifact: string; approved: string; uploaded: string };
  privacy: 'private' | 'unlisted' | 'public' | string;
  processing: 'succeeded' | string;
  embeddable: boolean;
  publicApproval: boolean;
  studioReviewed: boolean;
  blocked: boolean;
}): Readonly<{ eligible: boolean; reasons: readonly string[] }>;
export function normalizeDailyLimits(value?: Partial<DailyLimits>): Readonly<DailyLimits>;
export function normalizedContentFingerprint(script: Pick<VideoScript, 'title' | 'original_observation' | 'scenes'>): string;
