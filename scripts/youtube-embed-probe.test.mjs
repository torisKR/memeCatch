import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { producedVideoEmbedUrl } from "../lib/video-production/video-schema.mjs";
import { embedProbeHtml, validateEmbedProbeInput, validatePlaybackEvidence, verifyYouTubeEmbed } from "./youtube-embed-probe.mjs";

const input = { videoId: "AbcDef012-_", channelId: "UCBxN8lUb-5dDuOPv-szpF4g", artifactHash: "a".repeat(64) };
const played = { ready: true, playing: true, error: null, videoId: input.videoId, firstTime: 0.1, lastTime: 1.2 };
test("accepts only exact IDs and hashes, not URLs or script injection", () => {
  assert.doesNotThrow(() => validateEmbedProbeInput(input));
  for (const value of ["https://youtu.be/AbcDef012-_", "</script>", "short"]) {
    assert.throws(() => validateEmbedProbeInput({ ...input, videoId: value }), /invalid_embed_video_id/);
  }
  assert.throws(() => validateEmbedProbeInput({ ...input, channelId: "UCwrong" }), /invalid_embed_channel_id/);
  assert.throws(() => validateEmbedProbeInput({ ...input, artifactHash: "A".repeat(64) }), /invalid_embed_artifact_hash/);
});
test("uses official IFrame API and current-time playback, never oEmbed metadata", () => {
  const html = embedProbeHtml(input.videoId);
  assert.match(html, /https:\/\/www.youtube.com\/iframe_api/);
  assert.match(html, /getCurrentTime/);
  assert.match(html, /PlayerState.PLAYING/);
  assert.doesNotMatch(html, /oembed|download|fetch\(/i);
});
test("attaches the probe API to the same privacy-enhanced iframe host used by detail/schema", () => {
  const html = embedProbeHtml(input.videoId);
  const frame = { src: "" };
  let target, options;
  const context = { URL, document: { getElementById: () => frame }, location: { origin: "http://127.0.0.1:43210" },
    window: {}, setInterval() {}, YT: { Player: function(id, value) { target = id; options = value; } } };
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript);
  runInNewContext(inlineScript, context);
  context.window.onYouTubeIframeAPIReady();
  const url = new URL(frame.src);
  assert.equal(`${url.origin}${url.pathname}`, producedVideoEmbedUrl(input.videoId));
  assert.equal(url.searchParams.get("enablejsapi"), "1");
  assert.equal(url.searchParams.get("origin"), context.location.origin);
  assert.equal(target, "player");
  assert.deepEqual(Object.keys(options), ["events"]);
});
test("rejects error, wrong loaded video, ready-only, paused or frozen playback", () => {
  for (const partial of [{ error: 150 }, { videoId: "other000000" }, { playing: false }, { ready: false }, { lastTime: 0.1 }, { firstTime: null }, { lastTime: NaN }]) {
    assert.throws(() => validatePlaybackEvidence({ ...played, ...partial }, input.videoId), /youtube_embed/);
  }
  assert.equal(validatePlaybackEvidence(played, input.videoId), true);
});
test("returns hash-bound proof only after playback, and propagates failure", async () => {
  let call;
  const proof = await verifyYouTubeEmbed(input, { probe: async (videoId) => { call = videoId; return played; } });
  assert.equal(call, input.videoId);
  assert.deepEqual({ ...proof, checkedAt: undefined }, { verified: true, videoId: input.videoId, artifactHash: input.artifactHash, checkedAt: undefined });
  assert.ok(Number.isFinite(Date.parse(proof.checkedAt)));
  await assert.rejects(verifyYouTubeEmbed(input, { probe: async () => ({ ...played, error: 100 }) }), /player_rejected/);
});
