#!/usr/bin/env node
// Prints the rows mpe-candidates.mjs works on, as SQL for the superuser of a
// throwaway database. Ids start with c5c0 (ingestions), d5c0 (jobs), e5c1
// (segments), f5c0 (memes), f5c1 (candidates), a5c0 (sources). Run it again
// before each comparison: the route writes fingerprints, matches and
// candidates.
//
//   node server/parity/mpe-candidates-seed.mjs <state.json> | docker exec -i <c> psql -U postgres -d memecatch
//
// state.json: { "operator": { "userId", ... }, "user": { "userId", ... } }
import { readFileSync } from "node:fs";

const { operator } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const uuid = (prefix, n) => `${prefix}0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = {
  ingestion: (n) => uuid("c5c0", n),
  job: (n) => uuid("d5c0", n),
  segment: (n) => uuid("e5c1", n),
  meme: (n) => uuid("f5c0", n),
  candidate: (n) => uuid("f5c1", n),
  source: (n) => uuid("a5c0", n),
};
const q = (text) => (text === null ? "null" : `'${String(text).replaceAll("'", "''")}'`);
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;
const embedding = (seed) => `array[${Array.from({ length: 64 }, (_, i) => ((i * seed) % 7) - 3).join(",")}]::float8[]`;

// [n, kind, mime, mode, source]
const ingestions = [
  [1, "image", "image/png", "USER_UPLOADED", 2],
  [2, "video", "video/mp4", "OWNER_AUTHORIZED", 1],
  [3, "image", "image/png", "USER_UPLOADED", null],
  [4, "image", "image/jpeg", "USER_UPLOADED", null],
  [5, "image", "image/webp", "USER_UPLOADED", null],
  [6, "video", "video/webm", "LICENSED_MEDIA", null],
  [7, "image", "image/gif", "USER_UPLOADED", null],
  [8, "video", "video/mp4", "USER_UPLOADED", null],
  [9, "image", "image/png", "USER_UPLOADED", null],
  // Earlier ingestions whose candidates point at memes.
  [21, "image", "image/png", "USER_UPLOADED", 1],
  [22, "video", "video/mp4", "OWNER_AUTHORIZED", 1],
  [23, "image", "image/png", "USER_UPLOADED", 3],
];
const sceneOk = { provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 2 };
const sttDisabled = { reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha", providerBacked: false, segmentsWritten: 0, audioDetected: true };
// [ingestion, type, status, version, error, output]
const jobs = [
  [1, "inspect", "completed", "1", null, { hasAudio: false }],
  [1, "fingerprint", "completed", "1", null, {}],
  [1, "ocr", "completed", "1", null, {}],
  [2, "inspect", "completed", "1", null, { hasAudio: true }],
  [2, "fingerprint", "completed", "1", null, {}],
  [2, "scene_frames", "completed", "1.1.0", null, sceneOk],
  [2, "stt", "skipped", "1", null, sttDisabled],
  [3, "inspect", "completed", "1", null, {}],
  [3, "fingerprint", "completed", "1", null, {}],
  [3, "ocr", "failed", "1", "ocr_failed", {}],
  [4, "inspect", "completed", "1", null, {}],
  [4, "fingerprint", "completed", "1", null, {}],
  [4, "ocr", "completed", "1", null, { reason: "ocr_not_configured" }],
  [5, "inspect", "completed", "1", null, {}],
  [5, "fingerprint", "completed", "1", null, {}],
  [6, "inspect", "completed", "1", null, { hasAudio: false }],
  [6, "fingerprint", "completed", "1", null, {}],
  [6, "scene_frames", "completed", "1.1.0", null, { ...sceneOk, segmentsWritten: 0 }],
  [6, "stt", "skipped", "1", null, { reason: "no_audio", segmentsWritten: 0, audioDetected: false }],
  [7, "inspect", "completed", "1", null, {}],
  [7, "fingerprint", "completed", "1", null, {}],
  [7, "ocr", "completed", "1", null, {}],
  [8, "inspect", "completed", "1", null, { hasAudio: false }],
  [8, "fingerprint", "completed", "1", null, {}],
  [8, "scene_frames", "completed", "1.0.0", null, sceneOk],
  [8, "stt", "skipped", "1", null, { reason: "no_audio" }],
  [9, "inspect", "queued", "1", null, {}],
  [9, "fingerprint", "completed", "1", "token_not_configured_x", {}],
  [9, "ocr", "completed", "1", null, {}],
];
// [n, ingestion, origin, raw, normalized]
const segments = [
  [1, 1, "OCR", "중꺾마 그 장면!", "중꺾마 그 장면"],
  [2, 1, "CAPTION", "캡션 문장 Caption", null],
  [3, 1, "STT", "음성 전사", "음성 전사"],
  [4, 1, "METADATA", "  꺾이지 않는 마음  ", ""],
  [5, 2, "OCR", "영상 자막 중꺾마", "영상 자막 중꺾마"],
  [6, 2, "stt", "소문자 stt", null],
  [21, 21, "OCR", "중꺾마 이전 장면", null],
  [22, 22, "CAPTION", "꺾이지 않는 마음 영상", "꺾이지 않는 마음 영상"],
  [23, 22, "STT", "이전 음성", null],
  [24, 23, "OCR", "해시 밈 글자", null],
];
// [ingestion, type, hash, embedding]
const fingerprints = [
  [1, "SHA256", "a".repeat(64), null],
  [1, "PHASH", "ffff0000ffff0000", null],
  [1, "TEXT_EMBEDDING", "old", embedding(3)],
  [2, "FRAME_PHASH", "0f0f0f0f0f0f0f0f", null],
  [2, "AUDIO", "audio-1", null],
  [21, "SHA256", "a".repeat(64), null],
  [21, "PHASH", "ffff0000ffff0001", null],
  [22, "PHASH", "fFff0000fff00000", null],
  [22, "FRAME_PHASH", "0f0f0f0f0f0f0f0e", null],
  [22, "AUDIO", "audio-1", null],
  [22, "TEXT_EMBEDDING", "e22", embedding(5)],
  [23, "PHASH", "00000000ffffffff", null],
  [23, "SHA256", "b".repeat(64), null],
];

console.log(`-- Rows for server/parity/mpe-candidates.mjs. Throwaway database only.
delete from public.meme_candidates where id::text like 'f5c1%' or ingestion_id::text like 'c5c0%';
delete from public.media_ingestions where id::text like 'c5c0%';
delete from public.media_sources where id::text like 'a5c0%';
delete from public.memes where id::text like 'f5c0%';
delete from public.openrouter_daily_request_budget;
insert into public.media_sources (id, platform, external_id, canonical_url, title, channel_name) values
  ('${ids.source(1)}', 'youtube', 'yt-1', 'https://youtube.example/watch?v=1', '첫 영상', '채널A'),
  ('${ids.source(2)}', 'tiktok', 'tt-2', 'https://tiktok.example/@b/2', 'Second "video"', null),
  ('${ids.source(3)}', 'youtube', null, 'https://youtube.example/watch?v=3', null, '채널A');
insert into public.memes (id, title, slug, aliases, summary, description, moderation_status) values
  ('${ids.meme(1)}', '중꺾마 후보밈', 'r5c-cand-1', array['중꺾마', '꺾이지 않는 마음'], '중꺾마 요약', '꺾이지 않는 마음 설명', 'approved'),
  ('${ids.meme(2)}', '중꺾마 다른밈', 'r5c-cand-2', '{}', '다른 요약', 'Description 2', 'approved'),
  ('${ids.meme(3)}', '해시전용 사진', 'r5c-cand-3', '{}', '', '', 'approved'),
  ('${ids.meme(4)}', '중꺾마 대기밈', 'r5c-cand-4', '{}', '', '', 'pending');
insert into public.media_ingestions
  (id, source_id, user_id, ingest_mode, mime_type, media_kind, byte_size, sha256, temporary_storage_key, expires_at, rights_attested_at)
values
${ingestions.map(([n, kind, mime, mode, source]) => `  ('${ids.ingestion(n)}', ${source ? `'${ids.source(source)}'` : "null"}, '${operator.userId}', '${mode}', '${mime}', '${kind}', 1000, repeat('${n % 10}', 64), 'k/${n}', now() + interval '1 day', '2026-11-01T00:00:00.123456+00')`).join(",\n")};
insert into public.processing_jobs (id, ingestion_id, job_type, status, processor_name, processor_version, input_hash, error_code, output_json, started_at, completed_at) values
${jobs.map(([of, type, status, version, error, output], index) => `  ('${ids.job(index + 1)}', '${ids.ingestion(of)}', '${type}', '${status}', 'p', '${version}', 'h${index}', ${q(error)}, ${json(output)}, now(), now())`).join(",\n")};
insert into public.text_segments (id, ingestion_id, origin, raw_text, normalized_text) values
${segments.map(([n, of, origin, raw, normalized]) => `  ('${ids.segment(n)}', '${ids.ingestion(of)}', '${origin.toUpperCase()}', ${q(raw)}, ${q(normalized)})`).join(",\n")};
insert into public.media_fingerprints (ingestion_id, fingerprint_type, hash_value, embedding, processor_version) values
${fingerprints.map(([of, type, hash, vector]) => `  ('${ids.ingestion(of)}', '${type}', '${hash}', ${vector ?? "null"}, 'seed')`).join(",\n")};
insert into public.meme_candidates (id, ingestion_id, target_meme_id, title, meme_type, model_version, prompt_version, created_at) values
  ('${ids.candidate(1)}', '${ids.ingestion(1)}', null, '중꺾마 후보', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00+00'),
  ('${ids.candidate(2)}', '${ids.ingestion(2)}', null, 'Video candidate', 'VIDEO_SCENE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00+00'),
  ('${ids.candidate(7)}', '${ids.ingestion(7)}', null, '이미 있는 후보', 'OTHER', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00+00'),
  ('${ids.candidate(9)}', '${ids.ingestion(9)}', null, '중꺾마', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-02T00:00:00+00'),
  ('${ids.candidate(21)}', '${ids.ingestion(21)}', '${ids.meme(3)}', '이전 후보', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-01T00:00:00+00'),
  ('${ids.candidate(22)}', '${ids.ingestion(22)}', '${ids.meme(1)}', '이전 영상', 'VIDEO_SCENE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-01T00:00:00+00'),
  ('${ids.candidate(23)}', '${ids.ingestion(23)}', '${ids.meme(2)}', '해시 후보', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1', '2026-11-01T00:00:00+00');`);
