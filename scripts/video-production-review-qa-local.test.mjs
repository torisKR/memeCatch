import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  LOCAL_REVIEW_ORIGIN,
  parseReviewQaArgs,
  requestDisposition,
  validateReviewSnapshot,
  verifyReviewArtifact,
} from "./video-production-review-qa-local.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("accepts only the fixed review origin and a repository video-production artifact", () => {
  const parsed = parseReviewQaArgs([
    "--artifact-dir", "artifacts/video-production/example/render-v3",
    "--expected-sha", "a".repeat(64),
  ]);
  assert.equal(parsed.origin, LOCAL_REVIEW_ORIGIN);
  assert.equal(parsed.artifactDir, resolve("artifacts/video-production/example/render-v3"));
  assert.match(parsed.out, /artifacts\/video-production\/example\/render-v3$/u);
  assert.throws(() => parseReviewQaArgs(["--artifact-dir", "/tmp/private", "--expected-sha", "a".repeat(64)]), /artifact_directory_outside_video_production/u);
  assert.throws(() => parseReviewQaArgs(["--artifact-dir", "artifacts/video-production/x", "--expected-sha", "nope"]), /invalid_expected_sha/u);
  assert.throws(() => parseReviewQaArgs(["--origin", "https://example.test"]), /invalid_cli_arguments/u);
});

test("permits only GET and HEAD for the three fixed viewer routes", () => {
  assert.deepEqual(requestDisposition("GET", `${LOCAL_REVIEW_ORIGIN}/`), { allow: true, reason: "fixed_read_route" });
  assert.deepEqual(requestDisposition("HEAD", `${LOCAL_REVIEW_ORIGIN}/video.mp4`), { allow: true, reason: "fixed_read_route" });
  assert.deepEqual(requestDisposition("GET", `${LOCAL_REVIEW_ORIGIN}/poster.png`), { allow: true, reason: "fixed_read_route" });
  assert.equal(requestDisposition("POST", `${LOCAL_REVIEW_ORIGIN}/`).allow, false);
  assert.equal(requestDisposition("GET", "https://example.test/tracker").allow, false);
  assert.equal(requestDisposition("GET", `${LOCAL_REVIEW_ORIGIN}/review-candidate.json`).allow, false);
  assert.equal(requestDisposition("GET", `${LOCAL_REVIEW_ORIGIN}/video.mp4?token=secret`).allow, false);
});

test("validates the visible local-review, motion, playback, and no-schema contract", () => {
  const base = {
    viewport: "mobile-390x844-reduced",
    status: 200,
    headingCount: 1,
    heading: "새삥 챌린지 (지코)",
    notice: "로컬 검수용 / 업로드·공개 안 함",
    approvalRows: ["미승인", "미승인", "미승인", "미승인", "미승인"],
    publishableCopy: "발행 가능 미승인",
    structuredDataCount: 0,
    containsVideoObject: false,
    overflow: 0,
    reducedMotion: true,
    autoplay: false,
    error: null,
    metadata: { duration: 39.033, videoWidth: 1080, videoHeight: 1920, readyState: 4 },
    playback: { advanced: true, frameCount: 2, endedOrNearEnd: true },
  };
  assert.doesNotThrow(() => validateReviewSnapshot(base, { expectedTitle: base.heading, reduced: true, expectedDuration: 39.033 }));
  assert.throws(() => validateReviewSnapshot({ ...base, structuredDataCount: 1 }, { expectedTitle: base.heading, reduced: true, expectedDuration: 39.033 }), /structured_data_present/u);
  assert.throws(() => validateReviewSnapshot({ ...base, autoplay: true }, { expectedTitle: base.heading, reduced: true, expectedDuration: 39.033 }), /autoplay_enabled/u);
  assert.throws(() => validateReviewSnapshot({ ...base, playback: { ...base.playback, frameCount: 0 } }, { expectedTitle: base.heading, reduced: true, expectedDuration: 39.033 }), /video_frames_not_observed/u);
  assert.throws(() => validateReviewSnapshot({ ...base, approvalRows: ["미승인"] }, { expectedTitle: base.heading, reduced: true, expectedDuration: 39.033 }), /approval_state_mismatch/u);
});

test("verifies manifest identity and video bytes without accepting approval flags", async (t) => {
  const artifactDir = await mkdtemp(join(resolve("artifacts/video-production"), "review-qa-test-"));
  t.after(() => rm(artifactDir, { recursive: true, force: true }));
  const video = Buffer.from("local-video-bytes");
  const digest = sha256(video);
  const manifest = {
    kind: "real_meme_local_review_candidate",
    title: "새삥 챌린지 (지코)",
    sha256: digest,
    byteSize: video.byteLength,
    operatorReviewRequired: true,
    assetRightsApproved: false,
    productionApproval: false,
    operatorRightsApproval: false,
    artifactApproval: false,
    uploadConsent: false,
    publicationApproval: false,
    publishable: false,
    technicalCheck: { duration_ms: 39_033, width: 1080, height: 1920, passed: true },
  };
  await writeFile(join(artifactDir, "production.mp4"), video);
  await writeFile(join(artifactDir, "review-candidate.json"), JSON.stringify(manifest));
  const verified = await verifyReviewArtifact(artifactDir, digest);
  assert.equal(verified.title, manifest.title);
  assert.equal(verified.sha256, digest);
  assert.equal(verified.durationSeconds, 39.033);

  await writeFile(join(artifactDir, "review-candidate.json"), JSON.stringify({ ...manifest, publicationApproval: true }));
  await assert.rejects(verifyReviewArtifact(artifactDir, digest), /manifest_not_local_review_candidate/u);
});
