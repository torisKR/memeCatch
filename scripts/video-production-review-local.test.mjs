import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseLocalReviewArgs, startLocalReviewServer } from "./video-production-review-local.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t, overrides = {}) {
  const artifactDir = await mkdtemp(join(tmpdir(), "memecatch-local-review-test-"));
  t.after(() => rm(artifactDir, { recursive: true, force: true }));
  const video = Buffer.from("0123456789", "utf8");
  const poster = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const manifest = {
    kind: "real_meme_local_review_candidate",
    memeId: "meme-test",
    title: "<script>alert('제목')</script>",
    sha256: sha256(video),
    byteSize: video.byteLength,
    operatorReviewRequired: true,
    assetRightsApproved: false,
    productionApproval: false,
    operatorRightsApproval: false,
    artifactApproval: false,
    uploadConsent: false,
    publicationApproval: false,
    publishable: false,
    technicalCheck: { duration_ms: 31_000, width: 1080, height: 1920, passed: true },
    sources: [
      { title: "공식 <자료>", url: "https://example.test/source", approved: true },
      { title: "비허용 URL", url: "https://token@example.test/private", approved: true },
      { title: "서명 URL", url: "https://example.test/private?X-Amz-Signature=secret", approved: true },
      { title: "토큰 URL", url: "https://example.test/private?access_token=secret", approved: true },
    ],
    ...overrides,
  };
  await writeFile(join(artifactDir, "production.mp4"), video);
  await writeFile(join(artifactDir, "poster.png"), poster);
  await writeFile(join(artifactDir, "review-candidate.json"), `${JSON.stringify(manifest)}\n`, "utf8");
  return { artifactDir, video, poster };
}

async function runningServer(t, overrides) {
  const data = await fixture(t, overrides);
  const review = await startLocalReviewServer({ artifactDir: data.artifactDir, port: 0 });
  t.after(() => review.close());
  return { ...data, ...review };
}

test("parses only an artifact directory and an optional valid port", () => {
  assert.deepEqual(parseLocalReviewArgs(["--artifact-dir", "./artifact"]), {
    artifactDir: new URL("../artifact", import.meta.url).pathname.replace(/\/$/u, ""),
    port: 3015,
  });
  assert.equal(parseLocalReviewArgs(["--artifact-dir", "/tmp/artifact", "--port", "4321"]).port, 4321);
  assert.throws(() => parseLocalReviewArgs(["--artifact-dir", "/tmp/artifact", "--host", "0.0.0.0"]), /invalid_cli_arguments/u);
  assert.throws(() => parseLocalReviewArgs(["--artifact-dir", "/tmp/artifact", "--port", "0"]), /invalid_port/u);
});

test("serves an escaped local-only review page without structured video data or approval controls", async (t) => {
  const server = await runningServer(t);
  const response = await fetch(server.url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /로컬 검수용 \/ 업로드·공개 안 함/u);
  assert.match(html, /&lt;script&gt;alert\(&#39;제목&#39;\)&lt;\/script&gt;/u);
  assert.match(html, /공식 &lt;자료&gt;/u);
  assert.match(html, /https:\/\/example\.test\/source/u);
  assert.doesNotMatch(html, /token@example/u);
  assert.doesNotMatch(html, /X-Amz-Signature|access_token|서명 URL|토큰 URL/u);
  assert.doesNotMatch(html, /VideoObject/u);
  assert.doesNotMatch(html, /type=["']application\/ld\+json/u);
  assert.doesNotMatch(html, /<button|<form|checkbox/iu);
  assert.match(html, /공개 승인[\s\S]*미승인/u);
});

for (const flag of [
  "assetRightsApproved", "productionApproval", "operatorRightsApproval", "artifactApproval",
  "uploadConsent", "publicationApproval", "publishable",
]) {
  test(`rejects a positive ${flag} flag before listening`, async (t) => {
    const positive = await fixture(t, { [flag]: true });
    await assert.rejects(
      startLocalReviewServer({ artifactDir: positive.artifactDir, port: 0 }),
      /manifest_not_local_review_candidate/u,
    );
  });
}

test("serves fixed media routes with GET, HEAD, and one byte range", async (t) => {
  const server = await runningServer(t);

  const full = await fetch(`${server.url}video.mp4`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "video/mp4");
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), server.video);

  const head = await fetch(`${server.url}video.mp4`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(server.video.byteLength));
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const partial = await fetch(`${server.url}video.mp4`, { headers: { range: "bytes=2-5" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), `bytes 2-5/${server.video.byteLength}`);
  assert.equal(Buffer.from(await partial.arrayBuffer()).toString("utf8"), "2345");

  const poster = await fetch(`${server.url}poster.png`);
  assert.equal(poster.status, 200);
  assert.deepEqual(Buffer.from(await poster.arrayBuffer()), server.poster);
});

test("fails closed for invalid methods, paths, ranges, and a video hash mismatch", async (t) => {
  const server = await runningServer(t);
  assert.equal((await fetch(server.url, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${server.url}review-candidate.json`)).status, 404);
  assert.equal((await fetch(`${server.url}../review-candidate.json`)).status, 404);
  const range = await fetch(`${server.url}video.mp4`, { headers: { range: "bytes=1-2,4-5" } });
  assert.equal(range.status, 416);
  assert.equal(range.headers.get("content-range"), `bytes */${server.video.byteLength}`);

  const mismatch = await fixture(t, { sha256: "0".repeat(64) });
  await assert.rejects(startLocalReviewServer({ artifactDir: mismatch.artifactDir, port: 0 }), /video_sha256_mismatch/u);
});
