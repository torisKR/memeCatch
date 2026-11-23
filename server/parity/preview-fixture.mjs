#!/usr/bin/env node
// Writes the cases server/src/routes/public/meme_delivery.rs is held to, by
// running the real resolveMemeDelivery of lib/meme-delivery.ts under Node.
//
//   node server/parity/preview-fixture.mjs > server/tests/fixtures/preview_delivery.json
//
// Node 22.15 or later (it imports the .ts files directly). The output is
// deterministic: rerun it after lib/meme-delivery.ts, lib/sources/url.ts,
// lib/source-platform.ts or lib/content-availability.ts changes and the Rust
// test shows what moved.
//
// Each case is the `meme_contents` of one card and the reviewed media sources
// of its meme. `preview` is the index of the content POST /api/explore/previews
// would answer with (the representative, when embedding it is allowed), or -1.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// The TypeScript imports "@/lib/x" without an extension.
const root = new URL("../../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = fileURLToPath(new URL(specifier.slice(2), root));
      return { url: pathToFileURL(existsSync(`${path}.ts`) ? `${path}.ts` : path).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { resolveMemeDelivery } = await import("../../lib/meme-delivery.ts");

const NOW = Date.parse("2026-11-23T12:00:00.000Z");

// This script's own generator for building cases. Not one of the functions
// under test.
let state = 20261123;
function next(bound) {
  state = (Math.imul(state, 1103515245) + 12345) >>> 0;
  return Math.floor((state / 4294967296) * bound);
}
const pick = (items) => items[next(items.length)];

const YOUTUBE_IDS = ["dQw4w9WgXcQ", "aaaaaaaaaaa", "-_-_-_-_-_-"];
const TIKTOK_IDS = ["7301234567890123456", "1234567890"];
const INSTAGRAM_CODES = ["CxYz12345", "Reel_-999"];
// Every shape the URL normalizer tells apart, and some it refuses.
const urlsFor = {
  youtube: (id) => [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}?rel=0`,
    `https://m.youtube.com/watch?feature=share&v=${id}`,
    `  https://WWW.YouTube.com/watch?v=${id}  `,
    `http://www.youtube.com/watch?v=${id}`,
    `https://user:pw@www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}x`,
    `https://youtu.be/shorts/${id}`,
  ],
  tiktok: (id) => [
    `https://www.tiktok.com/@creator/video/${id}`,
    `https://www.tiktok.com/@creator/video/${id}/`,
    `https://m.tiktok.com/v/video/${id}?lang=ko`,
    `https://vt.tiktok.com/ZS${id.slice(0, 6)}/`,
    `https://www.tiktok.com/@creator/video/123`,
  ],
  instagram: (id) => [
    `https://www.instagram.com/p/${id}/`,
    `https://www.instagram.com/reel/${id}`,
    `https://instagram.com/tv/${id}/`,
    `https://www.instagram.com/reel/${id}/?igsh=abc`,
    `https://www.instagram.com/stories/${id}/`,
    `https://www.instagram.com/p/abc/`,
  ],
};
const OTHER_URLS = [null, null, "", "   ", "https://example.com/watch?v=dQw4w9WgXcQ", "not a url", "https://namu.wiki/w/밈"];
const PLATFORM_NAMES = [null, "", "youtube", "YouTube Shorts", "youtube_shorts", "tiktok", "틱톡", "instagram", "인스타그램", "community", "web"];

function reference() {
  const platform = pick(["youtube", "youtube", "tiktok", "instagram"]);
  const id = pick({ youtube: YOUTUBE_IDS, tiktok: TIKTOK_IDS, instagram: INSTAGRAM_CODES }[platform]);
  return { platform, id, url: pick(urlsFor[platform](id)) };
}

function content(shared) {
  const ref = next(4) === 0 ? reference() : shared;
  const hasUrl = next(5) !== 0;
  return {
    type: pick(["video", "video", "embed", "image", "text", "audio"]),
    thumbnail_url: next(2) ? "https://i.ytimg.com/vi/x/hqdefault.jpg" : null,
    is_representative: next(3) === 0,
    platform: next(3) === 0 ? pick(PLATFORM_NAMES) : ref.platform,
    url: hasUrl ? ref.url : pick(OTHER_URLS),
    content_id: next(6) === 0 ? pick([null, "", "other-id"]) : ref.id,
    availability: pick(["live", "live", "unchecked", "dead", "region_blocked"]),
    moderation_status: pick(["approved", "approved", "approved", "pending", "rejected", "reviewing"]),
    manual_video_verified: next(3) === 0,
  };
}

function source(shared) {
  const ref = next(4) === 0 ? reference() : shared;
  const platform = next(5) === 0
    ? pick(["youtube", "youtube_shorts", "tiktok", "instagram", "broadcast_archive", "public_archive", "web"])
    : ref.platform;
  const checked = pick([null, 0, 3_600_000, 86_400_000, 86_400_001, -1]);
  return {
    review_state: pick(["approved", "approved", "approved", "pending", "rejected", "removed"]),
    rights_basis: pick(["official_embed", "official_embed", "creator_permission", "creative_commons", "public_data", "link_only", "link_only", "unknown", "blocked"]),
    platform,
    external_id: next(6) === 0 ? pick([null, "other-id"]) : ref.id,
    canonical_url: next(6) === 0 ? reference().url.trim() : ref.url.trim(),
    embeddable: pick([null, true, true, false, false]),
    public_status: pick([null, "public", "public", "unknown", "unlisted", "private"]),
    removed_at: next(8) === 0 ? "2026-11-01T00:00:00+00:00" : null,
    // As Postgres writes a timestamptz into JSON.
    last_checked_at: checked === null
      ? null
      : new Date(NOW - checked).toISOString().replace("Z", "+00:00"),
  };
}

// A reference a content and a source can share, with only URLs the
// normalizer accepts for it.
function sharedReference() {
  const platform = pick(["youtube", "youtube", "tiktok", "instagram", "instagram"]);
  const id = pick({ youtube: YOUTUBE_IDS, tiktok: TIKTOK_IDS, instagram: INSTAGRAM_CODES }[platform]);
  const accepted = { youtube: 6, tiktok: 3, instagram: 4 }[platform];
  return { platform, id, urls: urlsFor[platform](id).slice(0, accepted) };
}

// A content that is shown unless the ledger or the selection says otherwise.
function goodContent(ref, overrides = {}) {
  return {
    type: "video",
    thumbnail_url: null,
    is_representative: false,
    platform: ref.platform,
    url: pick(ref.urls),
    content_id: ref.id,
    availability: pick(["live", "unchecked"]),
    moderation_status: "approved",
    manual_video_verified: ref.platform === "instagram" ? next(2) === 0 : false,
    ...overrides,
  };
}

// A ledger row for the same media. Most fields are the permissive value, so
// the one that is not decides the case.
function matchingSource(ref) {
  const checked = pick([null, 0, 3_600_000, 86_400_000, 86_400_001, 172_800_000, -1]);
  return {
    review_state: next(8) === 0 ? pick(["pending", "rejected", "removed"]) : "approved",
    rights_basis: pick(["official_embed", "official_embed", "creator_permission", "creative_commons", "public_data", "link_only", "link_only", next(2) ? "unknown" : "blocked"]),
    platform: ref.platform === "youtube" && next(3) === 0 ? "youtube_shorts" : ref.platform,
    external_id: next(10) === 0 ? pick([null, "other-id"]) : ref.id,
    canonical_url: (next(8) === 0 ? reference().url : pick(ref.urls)).trim(),
    embeddable: pick([null, true, false, false]),
    public_status: pick(["public", "public", "public", null, "unknown", next(2) ? "unlisted" : "private"]),
    removed_at: next(8) === 0 ? pick(["2026-11-01T00:00:00+00:00", ""]) : null,
    last_checked_at: checked === null
      ? null
      : new Date(NOW - checked).toISOString().replace("Z", "+00:00"),
  };
}

function record(contents, sources) {
  const delivery = resolveMemeDelivery({
    contents,
    sources: [],
    reviewedMediaSources: { ok: true, sources },
    now: NOW,
  });
  const preview = delivery.representative && delivery.embeddingAllowed
    ? contents.indexOf(delivery.representative)
    : -1;
  return { contents, sources, preview };
}

const cases = [];

// The ledger policy: one content, one or two rows about the same media.
for (let index = 0; index < 350; index += 1) {
  const ref = sharedReference();
  const withoutUrl = next(6) === 0;
  const content = goodContent(ref, {
    is_representative: next(2) === 0,
    url: withoutUrl ? pick([null, "", "  "]) : pick(ref.urls),
    platform: next(5) === 0 ? pick(PLATFORM_NAMES) : ref.platform,
    availability: next(40) === 0 ? "paused" : pick(["live", "unchecked"]),
  });
  const sources = Array.from({ length: 1 + (next(4) === 0 ? 1 : 0) }, () => matchingSource(ref));
  if (next(40) === 0) sources[0].platform = "vimeo";
  if (next(40) === 0) sources[0].public_status = "weird";
  cases.push(record([content], sources));
}

// The choice of a representative: two or three contents that are all shown,
// with no ledger row or permissive ones.
for (let index = 0; index < 250; index += 1) {
  const first = sharedReference();
  const second = next(2) === 0 ? first : sharedReference();
  const contents = Array.from({ length: 2 + next(2) }, (_, position) => {
    const ref = position === 0 ? first : second;
    return goodContent(ref, {
      type: pick(["video", "video", "embed", "image", "text"]),
      is_representative: next(3) === 0,
      url: next(5) === 0 ? null : pick(ref.urls),
      content_id: next(8) === 0 ? null : ref.id,
      platform: next(6) === 0 ? pick(PLATFORM_NAMES) : ref.platform,
    });
  });
  const sources = next(3) === 0
    ? [{ ...matchingSource(first), review_state: "approved", rights_basis: pick(["official_embed", "link_only"]), embeddable: true, public_status: "public", removed_at: null }]
    : [];
  cases.push(record(contents, sources));
}

// Two different videos, the first with a ledger row that is permissive
// except that the platform refuses embedding. Whether that row suppresses the
// first video or leaves it as a link decides if the second one is shown.
for (let index = 0; index < 150; index += 1) {
  const first = sharedReference();
  let second = sharedReference();
  while (second.id === first.id) second = sharedReference();
  const contents = [goodContent(first), goodContent(second)];
  const row = {
    ...matchingSource(first),
    review_state: "approved",
    rights_basis: pick(["official_embed", "creator_permission", "link_only"]),
    platform: first.platform,
    external_id: first.id,
    canonical_url: pick(first.urls).trim(),
    embeddable: pick([false, false, false, null]),
    public_status: pick(["public", "public", "unknown", null]),
    removed_at: null,
  };
  cases.push(record(contents, [row]));
}

// Cases the families above reach only by luck, spelled out.
{
  const video = (id, overrides = {}) => ({
    type: "video", thumbnail_url: null, is_representative: false, platform: "youtube",
    url: `https://www.youtube.com/watch?v=${id}`, content_id: id, availability: "live",
    moderation_status: "approved", manual_video_verified: false, ...overrides,
  });
  const row = (id, overrides = {}) => ({
    review_state: "approved", rights_basis: "official_embed", platform: "youtube",
    external_id: id, canonical_url: `https://www.youtube.com/watch?v=${id}`, embeddable: false,
    public_status: "public", removed_at: null, last_checked_at: null, ...overrides,
  });
  const [a, b] = YOUTUBE_IDS;
  const at = (ago) => new Date(NOW - ago).toISOString().replace("Z", "+00:00");
  // Embedding refused by the platform: a link while the status is fresh.
  for (const ago of [0, 86_400_000, 86_400_001, -1, -86_400_000]) {
    cases.push(record([video(a), video(b)], [row(a, { last_checked_at: at(ago) })]));
  }
  cases.push(record([video(a), video(b)], [row(a, { last_checked_at: "yesterday" })]));
  // The URL and the content id name different videos.
  cases.push(record([video(a, { content_id: b })], []));
  cases.push(record([video(a, { content_id: b }), video(b)], []));
  // Not https: the URL is not a reference to anything.
  for (const url of [`http://www.youtube.com/watch?v=${a}`, `https://user@www.youtube.com/watch?v=${a}`]) {
    cases.push(record([video(a, { url })], []));
    cases.push(record([video(a, { url })], [row(a, { embeddable: true })]));
    cases.push(record([video(a, { url, content_id: b })], []));
  }
}

// Anything at all, mostly suppressed for one reason or another.
for (let index = 0; index < 150; index += 1) {
  const shared = reference();
  const contents = Array.from({ length: 1 + next(3) }, () => content(shared));
  const sources = Array.from({ length: next(4) }, () => source(shared));
  cases.push(record(contents, sources));
}

process.stdout.write(`${JSON.stringify({ now: NOW, cases })}\n`);
