import { strict as assert } from "node:assert";
import {
  PENDING_BACKLOG_WINDOW_MS,
  hasRecentPendingBacklog,
  isUsableReviewedSource,
  runDiscovery,
  selectDiscoveryMemes,
} from "./discover-youtube-candidates.mjs";

const now = new Date("2026-09-14T00:00:00.000Z");
const source = (overrides = {}) => ({
  platform: "youtube",
  external_id: "abcdefghijk",
  canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
  embeddable: true,
  public_status: "public",
  removed_at: null,
  ...overrides,
});
const link = (meme_id, overrides = {}) => ({
  meme_id,
  source_id: "source-1",
  review_state: "approved",
  rights_basis: "official_embed",
  created_at: now.toISOString(),
  media_sources: source(),
  ...overrides,
});
const memes = [
  { id: "none", title: "No source" },
  { id: "approved", title: "Approved source" },
  { id: "rejected", title: "Rejected source" },
  { id: "removed", title: "Removed source" },
  { id: "unembeddable", title: "Unembeddable source" },
  { id: "pending", title: "Pending source" },
];

assert.equal(isUsableReviewedSource(link("approved")), true);
assert.equal(isUsableReviewedSource(link("rejected", { review_state: "rejected" })), false);
assert.equal(isUsableReviewedSource(link("removed", { media_sources: source({ removed_at: now.toISOString() }) })), false);
assert.equal(isUsableReviewedSource(link("unembeddable", { media_sources: source({ embeddable: false }) })), false);
assert.equal(isUsableReviewedSource(link("unknown", { rights_basis: "unknown" })), false);
assert.equal(isUsableReviewedSource(link("private", { media_sources: source({ public_status: "private" }) })), false);
assert.equal(isUsableReviewedSource(link("unlisted", { media_sources: source({ public_status: "unlisted" }) })), false);
assert.equal(isUsableReviewedSource(link("unknown-status", { media_sources: source({ public_status: "unknown" }) })), false);

const recentPending = link("pending", { review_state: "pending", rights_basis: "unknown" });
assert.equal(hasRecentPendingBacklog(recentPending, now), true);
assert.equal(
  hasRecentPendingBacklog({ ...recentPending, created_at: new Date(now.getTime() - PENDING_BACKLOG_WINDOW_MS).toISOString() }, now),
  false,
);

const selected = selectDiscoveryMemes(
  memes,
  [
    link("approved"),
    link("rejected", { review_state: "rejected" }),
    link("removed", { media_sources: source({ removed_at: now.toISOString() }) }),
    link("unembeddable", { media_sources: source({ embeddable: false }) }),
    recentPending,
  ],
  now,
  100,
);
assert.deepEqual(selected.map((meme) => meme.id), ["none", "rejected", "removed", "unembeddable"]);
assert.deepEqual(
  selectDiscoveryMemes(
    [{ id: "cooldown", title: "Cooldown" }],
    [
      link("cooldown", { review_state: "pending", rights_basis: "unknown" }),
      link("cooldown", { media_sources: source({ removed_at: now.toISOString() }) }),
    ],
    now,
    1,
  ),
  [],
);

const calls = [];
const rest = async (path, init) => {
  calls.push({ path, init });
  return [{ id: "new-source" }];
};
const candidate = {
  id: "abcdefghijk",
  snippet: { title: "same candidate", channelTitle: "creator", thumbnails: {} },
  status: { privacyStatus: "public", embeddable: true },
  contentDetails: {},
};

const run = await runDiscovery({
  rest,
  memes: [{ id: "none", title: "No source" }, { id: "rejected", title: "Rejected source" }],
  links: [link("rejected", { review_state: "rejected" })],
  searchYouTube: async (meme) => {
    if (meme.id === "none") return [candidate];
    throw new Error("provider quota exhausted");
  },
  now,
  max: 2,
  delayMs: 0,
  wait: async () => {},
});
assert.equal(run.stats.searched, 2);
assert.equal(run.stats.errors, 1);
assert.equal(run.stats.zeroResults, 0);
assert.equal(run.stats.linked, 1);
assert.equal(run.stats.replacementAbsent, 0);
assert.equal(calls.length, 2);
assert.match(calls[1].path, /^meme_media/);
assert.match(calls[1].init.body, /"review_state":"pending"/);
assert.match(calls[1].init.body, /"rights_basis":"unknown"/);

const duplicate = await runDiscovery({
  rest: async () => { throw new Error("must not write duplicate"); },
  memes: [{ id: "rejected", title: "Rejected source" }],
  links: [link("rejected", { review_state: "rejected" })],
  searchYouTube: async () => [candidate],
  now,
  max: 1,
  wait: async () => {},
});
assert.equal(duplicate.stats.candidates, 1);
assert.equal(duplicate.stats.skippedExisting, 1);
assert.equal(duplicate.stats.linked, 0);
assert.equal(duplicate.stats.replacementAbsent, 1);

const rejectedOnly = await runDiscovery({
  rest: async () => { throw new Error("must not write rejected candidate"); },
  memes: [{ id: "rejected", title: "Rejected source" }],
  links: [link("rejected", { review_state: "rejected" })],
  searchYouTube: async () => [candidate],
  now,
  max: 1,
  wait: async () => {},
});
assert.equal(rejectedOnly.stats.skippedExisting, 1);
assert.equal(rejectedOnly.stats.replacementAbsent, 1);

const mixed = await runDiscovery({
  rest,
  memes: [{ id: "rejected", title: "Rejected source" }],
  links: [link("rejected", { review_state: "rejected" })],
  searchYouTube: async () => [candidate, { ...candidate, id: "zyxwvutsrqp" }],
  now,
  max: 1,
  wait: async () => {},
});
assert.equal(mixed.stats.skippedExisting, 1);
assert.equal(mixed.stats.linked, 1);
assert.equal(mixed.stats.replacementAbsent, 0);

const zero = await runDiscovery({
  rest,
  memes: [{ id: "none", title: "No source" }],
  links: [],
  searchYouTube: async () => [],
  now,
  max: 1,
  wait: async () => {},
});
assert.equal(zero.stats.searched, 1);
assert.equal(zero.stats.zeroResults, 1);
assert.equal(zero.stats.errors, 0);

console.log("discovery supply eligibility, bounded pending backlog, duplicate protection, and error accounting OK");
