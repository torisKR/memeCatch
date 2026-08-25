import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  discoverHashCandidateIds,
  MpeCandidateError,
  rankCandidateMatches,
  validateCandidateJobs,
  withoutSttSegments,
} from "./candidates.server";

const source = {
  id: "source-new",
  platform: "youtube",
  external_id: "new",
  channel_name: "채널",
  title: "퇴근 밈",
};

describe("MPE candidate match repository scoring", () => {
  it("excludes legacy STT text from candidate matching inputs", () => {
    expect(withoutSttSegments([
      { origin: "OCR", raw_text: "화면 문구" },
      { origin: "STT", raw_text: "구형 Qwen 전사" },
      { origin: "stt", raw_text: "소문자 구형 전사" },
    ])).toEqual([{ origin: "OCR", raw_text: "화면 문구" }]);
  });

  it("allows candidate creation only after every required job is terminal and none failed", () => {
    expect(() => validateCandidateJobs("image", [
      { job_type: "inspect", status: "completed" },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "ocr", status: "completed" },
    ])).not.toThrow();
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: false } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.1.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 0,
      } },
      { job_type: "stt", status: "skipped", output_json: { reason: "no_audio" } },
    ])).not.toThrow();
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: true } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.1.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 1,
      } },
      { job_type: "stt", status: "skipped", output_json: {
        reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha",
        providerBacked: false, segmentsWritten: 0, audioDetected: true,
      } },
    ])).not.toThrow();
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: true } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.1.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 1,
      } },
      { job_type: "stt", status: "completed", output_json: {
        provider: "openrouter", model: "another/asr", providerBacked: true, segmentsWritten: 1, audioDetected: true,
      } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: false } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.0.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 1,
      } },
      { job_type: "stt", status: "skipped", output_json: {
        reason: "no_audio", segmentsWritten: 0, audioDetected: false,
      } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: false } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.1.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 1,
      } },
      { job_type: "stt", status: "skipped", output_json: {
        reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha",
        providerBacked: false, segmentsWritten: 0, audioDetected: true,
      } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: true } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed", processor_version: "1.1.0", output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 1,
      } },
      { job_type: "stt", status: "skipped", output_json: {
        reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha",
        providerBacked: false, segmentsWritten: 0, audioDetected: true, extra: true,
      } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: true } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed" },
      { job_type: "stt", status: "skipped", output_json: { reason: "audio_stt_disabled" } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: false } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed" },
      { job_type: "stt", status: "skipped", output_json: { reason: "audio_not_found" } },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed" },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "running" },
      { job_type: "stt", status: "completed" },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("image", [
      { job_type: "inspect", status: "completed" },
      { job_type: "fingerprint", status: "failed" },
      { job_type: "ocr", status: "completed" },
    ])).toThrowError(new MpeCandidateError("processing_jobs_failed", 409));
    expect(() => validateCandidateJobs("image", [
      { job_type: "inspect", status: "completed" },
      { job_type: "fingerprint", status: "completed" },
    ])).toThrowError(new MpeCandidateError("processing_jobs_not_terminal", 409));
    expect(() => validateCandidateJobs("video", [
      { job_type: "inspect", status: "completed", output_json: { hasAudio: true } },
      { job_type: "fingerprint", status: "completed" },
      { job_type: "scene_frames", status: "completed" },
      { job_type: "stt", status: "skipped", output_json: { reason: "provider_not_configured" } },
    ])).toThrowError(new MpeCandidateError("processing_provider_not_configured", 409));
  });

  it("discovers prior meme candidates from exact and perceptual hashes without text search", () => {
    expect(discoverHashCandidateIds(
      [
        { fingerprint_type: "SHA256", hash_value: "abcd" },
        { fingerprint_type: "PHASH", hash_value: "ffff" },
      ],
      [
        { ingestion_id: "ingestion-exact", target_meme_id: "meme-exact" },
        { ingestion_id: "ingestion-visual", target_meme_id: "meme-visual" },
      ],
      [
        { ingestion_id: "ingestion-exact", fingerprint_type: "SHA256", hash_value: "abcd" },
        { ingestion_id: "ingestion-visual", fingerprint_type: "PHASH", hash_value: "fffe" },
      ],
    )).toEqual(["meme-exact", "meme-visual"]);
  });

  it("returns exactly the top five in deterministic score order", () => {
    const matches = rankCandidateMatches({
      candidateId: "candidate",
      title: "퇴근하고 싶다",
      rightsMode: "USER_UPLOADED",
      source,
      text: ["퇴근하고 싶다"],
      fingerprints: [],
      memes: Array.from({ length: 7 }, (_, index) => ({
        id: `meme-${index}`,
        title: index === 6 ? "퇴근하고 싶다" : `다른 밈 ${index}`,
        aliases: [],
        summary: "",
        description: "",
        sources: [],
        text: [],
        fingerprints: [],
      })),
    });

    expect(matches).toHaveLength(5);
    expect(matches[0].meme_id).toBe("meme-6");
    expect(matches.map((match) => match.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not score visual or audio evidence without processing rights", () => {
    const [match] = rankCandidateMatches({
      candidateId: "candidate",
      title: "다른 제목",
      rightsMode: "METADATA_ONLY",
      source,
      text: [],
      fingerprints: [
        { fingerprint_type: "SHA256", hash_value: "ffff" },
        { fingerprint_type: "PHASH", hash_value: "ffff" },
        { fingerprint_type: "AUDIO", hash_value: "ffff" },
      ],
      memes: [{
        id: "meme",
        title: "밈",
        aliases: [],
        summary: "",
        description: "",
        sources: [],
        text: [],
        fingerprints: [
          { fingerprint_type: "SHA256", hash_value: "ffff" },
          { fingerprint_type: "PHASH", hash_value: "ffff" },
          { fingerprint_type: "AUDIO", hash_value: "ffff" },
        ],
      }],
    });

    expect(match.visual_score).toBeNull();
    expect(match.audio_score).toBeNull();
    expect(match.evidence_json.exactDuplicate).toBe(false);
    expect(match.evidence_json.availableSignals).not.toContain("visual");
    expect(match.evidence_json.availableSignals).not.toContain("audio");
  });

  it("uses matching source identity as the exact duplicate hard rule", () => {
    const [match] = rankCandidateMatches({
      candidateId: "candidate",
      title: "무관",
      rightsMode: "METADATA_ONLY",
      source,
      text: [],
      fingerprints: [],
      memes: [{
        id: "meme",
        title: "전혀 다름",
        aliases: [],
        summary: "",
        description: "",
        sources: [source],
        text: [],
        fingerprints: [],
      }],
    });

    expect(match.overall_score).toBe(1);
    expect(match.classification).toBe("DUPLICATE");
  });

  it("uses authorized audio fingerprints as an independent weighted signal", () => {
    const [match] = rankCandidateMatches({
      candidateId: "candidate",
      title: "새 소리 밈",
      rightsMode: "USER_UPLOADED",
      source: null,
      text: [],
      fingerprints: [{ fingerprint_type: "AUDIO", hash_value: "abcd" }],
      memes: [{
        id: "meme",
        title: "기존 소리 밈",
        aliases: [],
        summary: "",
        description: "",
        sources: [],
        text: [],
        fingerprints: [{ fingerprint_type: "AUDIO", hash_value: "abcd" }],
      }],
    });

    expect(match.audio_score).toBe(1);
    expect(match.evidence_json.availableSignals).toContain("audio");
    expect(match.overall_score).toBeGreaterThan(0);
  });
});
