import { strict as assert } from "node:assert";
import {
  DISCOVERY_AUDIT_BUCKETS,
  PENDING_BACKLOG_WINDOW_MS,
  assertYouTubeRawOnlyPolicy,
  buildDiscoveryQueries,
  classifyDiscoveryAudit,
  createYouTubeSearcher,
  hasRecentPendingBacklog,
  isEligibleVideoMeme,
  isUsablePublishedContent,
  isUsableReviewedSource,
  loadDiscoveryEnv,
  parseDiscoveryArgs,
  runDiscoveryAudit,
  runDiscovery,
  selectDiscoveryMemes,
  validateYouTubeChannelId,
  validateYouTubeVideos,
} from "./discover-youtube-candidates.mjs";

const now = new Date("2026-09-14T00:00:00.000Z");
const whiplashMemeId = "6aa7aafc-978d-475a-b784-c0808ff6cfc0";
const videoMeme = (id, overrides = {}) => ({
  id, title: id, category: "challenge", media_type: "video",
  moderation_status: "approved", meme_contents: [], ...overrides,
});
const source = (overrides = {}) => ({
  platform: "youtube", external_id: "abcdefghijk",
  canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
  embeddable: true, public_status: "public", removed_at: null,
  metadata_refreshed_at: new Date(now.getTime() - 86_400_000).toISOString(),
  metadata_expires_at: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
  last_checked_at: new Date(now.getTime() - 86_400_000).toISOString(),
  ...overrides,
});
const link = (meme_id, overrides = {}) => ({
  meme_id, source_id: "source-1", review_state: "approved",
  rights_basis: "official_embed", created_at: now.toISOString(),
  media_sources: source(), ...overrides,
});
const candidate = (overrides = {}) => ({
  id: "abcdefghijk",
  snippet: {
    title: "same candidate", channelTitle: "creator",
    channelId: "UCBSPgsi3DjJ0-EUEA-Spjug", publishedAt: "2026-09-01T00:00:00Z",
    thumbnails: {},
  },
  status: { privacyStatus: "public", embeddable: true },
  contentDetails: { duration: "PT12S", regionRestriction: { allowed: ["KR"] } },
  ...overrides,
});

assert.equal(isEligibleVideoMeme(videoMeme("video")), true);
assert.equal(isEligibleVideoMeme(videoMeme("term", { category: "phrase", media_type: "text" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("phrase-video", { category: "phrase" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("image", { category: "image", media_type: "image" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("image-video", { category: "image", media_type: "video" })), true);
assert.equal(isEligibleVideoMeme(videoMeme("image-embed", { category: "image", media_type: "embed" })), true);
assert.equal(isEligibleVideoMeme(videoMeme("song", { category: "song", media_type: "audio" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("song-text", { category: "song", media_type: "text" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("dance-image", { category: "dance", media_type: "image" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("challenge-text", { category: "challenge", media_type: "text" })), false);
assert.equal(
  isEligibleVideoMeme(videoMeme("editor-classified", { category: "dance", media_type: "image" }), true),
  true,
);
assert.equal(isEligibleVideoMeme(videoMeme("comment-text", { category: "comment", media_type: "text" })), false);
assert.equal(isEligibleVideoMeme(videoMeme("pending", { moderation_status: "pending" })), false);

assert.equal(isUsableReviewedSource(link("approved")), true);
assert.equal(isUsableReviewedSource(link("private", { media_sources: source({ public_status: "private" }) })), false);
assert.equal(isUsableReviewedSource(link("unlisted", { media_sources: source({ public_status: "unlisted" }) })), false);
assert.equal(isUsableReviewedSource(link("removed", { media_sources: source({ removed_at: now.toISOString() }) })), false);
assert.equal(isUsableReviewedSource(link("unknown", { rights_basis: "unknown" })), false);

assert.equal(isUsablePublishedContent({ type: "embed", moderation_status: "approved", availability: "live" }), true);
assert.equal(isUsablePublishedContent({ type: "video", moderation_status: "approved", availability: "live" }), true);
assert.equal(isUsablePublishedContent({ type: "embed", moderation_status: "approved", availability: "live", production_id: "owned-production" }), false);
assert.equal(isUsablePublishedContent({ type: "image", moderation_status: "approved", availability: "live" }), false);
assert.equal(isUsablePublishedContent({ type: "embed", moderation_status: "pending", availability: "live" }), false);
assert.equal(isUsablePublishedContent({ type: "embed", moderation_status: "approved", availability: "dead" }), false);

const recentPending = link("pending", { review_state: "pending", rights_basis: "unknown" });
assert.equal(hasRecentPendingBacklog(recentPending, now), true);
assert.equal(hasRecentPendingBacklog({ ...recentPending, created_at: new Date(now.getTime() - PENDING_BACKLOG_WINDOW_MS).toISOString() }, now), false);
assert.equal(hasRecentPendingBacklog({ ...recentPending, created_at: new Date(now.getTime() + 60_000).toISOString() }, now), false);

const selected = selectDiscoveryMemes(
  [
    videoMeme("missing"),
    videoMeme("term", { category: "phrase", media_type: "text" }),
    videoMeme("image", { category: "image", media_type: "image" }),
    videoMeme("published", { meme_contents: [{ type: "embed", moderation_status: "approved", availability: "live" }] }),
    videoMeme("approved"),
    videoMeme("pending"),
  ],
  [link("approved"), recentPending], now, 20,
);
assert.deepEqual(selected.map((meme) => meme.id), ["missing"]);
assert.deepEqual(selectDiscoveryMemes([videoMeme("missing")], [], now, 0), []);
assert.deepEqual(
  selectDiscoveryMemes(
    [videoMeme("before"), videoMeme(whiplashMemeId), videoMeme("after")],
    [],
    now,
    1,
    whiplashMemeId,
  ).map((meme) => meme.id),
  [whiplashMemeId],
);
assert.deepEqual(
  selectDiscoveryMemes(
    [videoMeme(whiplashMemeId, { category: "dance", media_type: "image" })],
    [],
    now,
    1,
    whiplashMemeId,
    true,
  ).map((meme) => meme.id),
  [whiplashMemeId],
);

for (const unavailableSource of [
  source({ public_status: "private" }),
  source({ public_status: "unlisted" }),
  source({ embeddable: false }),
  source({ removed_at: now.toISOString() }),
]) {
  const recovery = videoMeme("partial-sync", {
    meme_contents: [{
      type: "embed",
      platform: "YouTube Shorts",
      content_id: "abcdefghijk",
      url: "https://www.youtube.com/shorts/abcdefghijk",
      moderation_status: "approved",
      availability: "live",
    }],
  });
  assert.deepEqual(
    selectDiscoveryMemes(
      [recovery],
      [link("partial-sync", { media_sources: unavailableSource })],
      now,
      1,
    ).map((meme) => meme.id),
    ["partial-sync"],
  );
}
assert.deepEqual(
  selectDiscoveryMemes(
    [videoMeme("different-source", {
      meme_contents: [{
        type: "embed",
        platform: "YouTube Shorts",
        content_id: "abcdefghijk",
        url: "https://youtu.be/abcdefghijk",
        moderation_status: "approved",
        availability: "live",
      }],
    })],
    [link("different-source", {
      media_sources: source({
        external_id: "lmnopqrstuv",
        canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv",
        public_status: "private",
      }),
    })],
    now,
    1,
  ),
  [],
);

assert.equal(validateYouTubeChannelId("UCBSPgsi3DjJ0-EUEA-Spjug"), "UCBSPgsi3DjJ0-EUEA-Spjug");
assert.throws(() => validateYouTubeChannelId("not-a-channel"), /channel/i);
assert.deepEqual(validateYouTubeVideos([candidate()], { channelId: null }), [candidate()]);
assert.deepEqual(validateYouTubeVideos([candidate()], { channelId: "UCBSPgsi3DjJ0-EUEA-Spjug" }), [candidate()]);
assert.deepEqual(validateYouTubeVideos([candidate()], { channelId: "UCaaaaaaaaaaaaaaaaaaaaaa" }), []);
assert.deepEqual(validateYouTubeVideos([candidate({ status: { privacyStatus: "unlisted", embeddable: true } })]), []);
assert.deepEqual(validateYouTubeVideos([candidate({ status: { privacyStatus: "public", embeddable: false } })]), []);
assert.deepEqual(validateYouTubeVideos([candidate({ contentDetails: { duration: "PT12S", regionRestriction: { blocked: ["KR"] } } })]), []);
assert.deepEqual(validateYouTubeVideos([candidate({ snippet: { title: "incomplete" } })]), []);

const youtubeCalls = [];
const ownedChannelSearch = createYouTubeSearcher({
  apiKey: "test-key",
  channelId: "UCBSPgsi3DjJ0-EUEA-Spjug",
  request: async (_apiKey, path, params) => {
    youtubeCalls.push({ path, params });
    return path === "search"
      ? { items: [{ id: { videoId: "abcdefghijk" } }] }
      : { items: [candidate(), candidate({ id: "zyxwvutsrqp", snippet: { ...candidate().snippet, channelId: "UCaaaaaaaaaaaaaaaaaaaaaa" } })] };
  },
});
assert.deepEqual(await ownedChannelSearch.search(videoMeme("owned")), [candidate()]);
assert.equal(youtubeCalls[0].params.channelId, "UCBSPgsi3DjJ0-EUEA-Spjug");
assert.deepEqual(ownedChannelSearch.usage, { searchRequests: 1, videosRequests: 1, apiRequests: 2 });

const malformedSearch = createYouTubeSearcher({ apiKey: "test-key", request: async () => ({}) });
await assert.rejects(() => malformedSearch.search(videoMeme("broken")), /items/i);

assert.deepEqual(parseDiscoveryArgs(["--max=0", "--plan-only"]), {
  max: 0, delayMs: 400, dryRun: false, planOnly: true, execute: false,
  auditOnly: false, channelId: null, memeId: null, editorVideoClassified: false,
});
assert.deepEqual(parseDiscoveryArgs([]), {
  max: 20, delayMs: 400, dryRun: false, planOnly: true, execute: false,
  auditOnly: false, channelId: null, memeId: null, editorVideoClassified: false,
});
assert.deepEqual(parseDiscoveryArgs([
  "--execute",
  "--max=1",
  "--channel-id=UCBSPgsi3DjJ0-EUEA-Spjug",
  `--meme-id=${whiplashMemeId}`,
]), {
  max: 1, delayMs: 400, dryRun: false, planOnly: false, execute: true,
  auditOnly: false,
  channelId: "UCBSPgsi3DjJ0-EUEA-Spjug", memeId: whiplashMemeId,
  editorVideoClassified: false,
});
assert.deepEqual(
  parseDiscoveryArgs([
    "--plan-only",
    "--max=1",
    `--meme-id=${whiplashMemeId}`,
    "--editor-video-classified",
  ]),
  {
    max: 1, delayMs: 400, dryRun: false, planOnly: true, execute: false,
    auditOnly: false, channelId: null, memeId: whiplashMemeId, editorVideoClassified: true,
  },
);
assert.deepEqual(parseDiscoveryArgs(["--audit-only"]), {
  max: null, delayMs: null, dryRun: false, planOnly: false, execute: false,
  auditOnly: true, channelId: null, memeId: null, editorVideoClassified: false,
});
assert.equal(parseDiscoveryArgs(["--audit-only", `--meme-id=${whiplashMemeId}`]).memeId, whiplashMemeId);
assert.equal(parseDiscoveryArgs(["--max=999"]).max, 20);
assert.throws(() => parseDiscoveryArgs(["--execute"]), /explicit --max/i);
assert.throws(
  () => parseDiscoveryArgs(["--execute", "--max=1"], {
    YOUTUBE_DISCOVERY_CHANNEL_ID: "UCBSPgsi3DjJ0-EUEA-Spjug",
  }),
  /--channel-id/i,
);
assert.throws(
  () => parseDiscoveryArgs(["--execute", "--max=2", "--channel-id=UCBSPgsi3DjJ0-EUEA-Spjug"]),
  /--max=1/i,
);
assert.throws(() => parseDiscoveryArgs(["--execute", "--max=3", "--plan-only"]), /mutually exclusive/i);
assert.throws(() => parseDiscoveryArgs(["--dry-run", "--max=3"]), /--execute/i);
assert.throws(() => parseDiscoveryArgs(["--execute", "--max=1", "--all-channels"]), /unknown/i);
assert.throws(() => parseDiscoveryArgs(["--editor-video-classified"]), /meme-id/i);
assert.throws(() => parseDiscoveryArgs(["--meme-id=not-a-uuid"]), /meme-id/i);
assert.throws(() => parseDiscoveryArgs(["--max=-1"]), /max/i);
assert.throws(() => parseDiscoveryArgs(["--max=nope"]), /max/i);
for (const incompatible of [
  "--execute", "--dry-run", "--plan-only", "--editor-video-classified",
  "--max=1", "--delay=400", "--channel-id=UCBSPgsi3DjJ0-EUEA-Spjug",
]) {
  assert.throws(() => parseDiscoveryArgs(["--audit-only", incompatible]), /cannot be combined/i);
}

const targetedQueries = buildDiscoveryQueries(whiplashMemeId);
assert.match(targetedQueries.links, new RegExp(`meme_id=eq\\.${whiplashMemeId}`));
assert.match(targetedQueries.memes, new RegExp(`id=eq\\.${whiplashMemeId}`));
assert.match(targetedQueries.memes, /moderation_status=in\.\(approved,limited\)/);
const auditQueries = buildDiscoveryQueries(null, { auditOnly: true });
assert.match(auditQueries.links, /order=meme_id\.asc,source_id\.asc/);
assert.match(auditQueries.links, /metadata_refreshed_at,metadata_expires_at,last_checked_at/);
assert.match(auditQueries.memes, /order=trend_score\.desc,id\.asc/);

const emptyAudit = classifyDiscoveryAudit([], [], now);
assert.deepEqual(Object.keys(emptyAudit.buckets), DISCOVERY_AUDIT_BUCKETS);
assert.deepEqual(Object.values(emptyAudit.counts), DISCOVERY_AUDIT_BUCKETS.map(() => 0));

const uncappedAudit = classifyDiscoveryAudit([
  ...Array.from({ length: 25 }, (_, index) => videoMeme(`uncapped-${index}`)),
  videoMeme("uncapped-0", { title: "duplicate join row must collapse" }),
], [], now);
assert.equal(uncappedAudit.counts.missing_source_or_replacement, 25);

const publishedContent = (overrides = {}) => ({
  type: "embed",
  platform: "YouTube Shorts",
  content_id: "abcdefghijk",
  url: "https://www.youtube.com/shorts/abcdefghijk",
  moderation_status: "approved",
  availability: "live",
  production_id: null,
  ...overrides,
});
const mergedDuplicateAudit = classifyDiscoveryAudit([
  videoMeme("duplicate-parent"),
  videoMeme("duplicate-parent", {
    meme_contents: [publishedContent({ url: null, platform: "TikTok", content_id: null })],
  }),
], [], now);
assert.equal(mergedDuplicateAudit.counts.published_media, 1);
assert.equal(mergedDuplicateAudit.counts.missing_source_or_replacement, 0);

const auditFixture = classifyDiscoveryAudit([
  videoMeme("published", { meme_contents: [publishedContent({ url: null, platform: "TikTok", content_id: null })] }),
  videoMeme("published-classification", {
    category: "dance", media_type: "image",
    meme_contents: [publishedContent({ url: null, platform: "TikTok", content_id: null })],
  }),
  videoMeme("projection"),
  videoMeme("recent"),
  videoMeme("stale"),
  videoMeme("classification", { category: "song", media_type: "text" }),
  videoMeme("classification-reviewed", { category: "challenge", media_type: "image" }),
  videoMeme("phrase-video", { category: "phrase" }),
  videoMeme("nonvisual", { category: "comment", media_type: "text" }),
  videoMeme("unknown-state", { meme_contents: [publishedContent()] }),
], [
  link("projection"),
  link("recent", { review_state: "pending", rights_basis: "unknown" }),
  link("stale", {
    review_state: "pending",
    rights_basis: "unknown",
    created_at: new Date(now.getTime() - PENDING_BACKLOG_WINDOW_MS).toISOString(),
  }),
  link("classification-reviewed"),
  link("unknown-state", {
    review_state: "approved",
    rights_basis: "official_embed",
    media_sources: source({ public_status: null, embeddable: null }),
  }),
], now);
assert.deepEqual(auditFixture.buckets.published_media.map((row) => row.id), [
  "published", "published-classification", "unknown-state",
]);
assert.ok(
  auditFixture.buckets.published_media
    .find((row) => row.id === "published-classification")
    .reasons.includes("classification_review_required"),
);
assert.deepEqual(auditFixture.buckets.projection_repair_or_reviewed_source.map((row) => row.id), ["projection"]);
assert.deepEqual(auditFixture.buckets.recent_pending_backlog.map((row) => row.id), ["recent"]);
assert.deepEqual(auditFixture.buckets.missing_source_or_replacement.map((row) => row.id), ["stale"]);
assert.ok(
  auditFixture.buckets.missing_source_or_replacement[0].reasons.includes("pending_backlog_stale_or_invalid"),
);
assert.deepEqual(auditFixture.buckets.classification_review.map((row) => row.id), [
  "classification", "classification-reviewed",
]);
assert.ok(
  auditFixture.buckets.classification_review
    .find((row) => row.id === "classification-reviewed")
    .reasons.includes("usable_reviewed_source_without_published_media"),
);
assert.deepEqual(auditFixture.buckets["excluded/nonvisual"].map((row) => row.id), [
  "phrase-video", "nonvisual",
]);

const storedProjectionAudit = classifyDiscoveryAudit([
  videoMeme("region-blocked", {
    meme_contents: [publishedContent({ availability: "region_blocked" })],
  }),
  videoMeme("dead", {
    meme_contents: [publishedContent({ availability: "dead" })],
  }),
  videoMeme("pending-projection", {
    meme_contents: [publishedContent({ moderation_status: "pending" })],
  }),
  videoMeme("already-published", {
    meme_contents: [publishedContent({
      platform: "YouTube",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    })],
  }),
  videoMeme("unrelated-child", {
    meme_contents: [publishedContent({
      content_id: "lmnopqrstuv",
      url: "https://www.youtube.com/watch?v=lmnopqrstuv",
      availability: "region_blocked",
    })],
  }),
  videoMeme("production-child", {
    meme_contents: [publishedContent({
      platform: "YouTube",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      production_id: "production-1",
    })],
  }),
  videoMeme("id-collision", {
    meme_contents: [publishedContent({ platform: "Instagram", url: null, availability: "unchecked" })],
  }),
  videoMeme("url-collision", {
    meme_contents: [publishedContent({
      platform: "YouTube",
      content_id: "lmnopqrstuv",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    })],
  }),
], [
  link("region-blocked"),
  link("dead"),
  link("pending-projection"),
  link("already-published"),
  link("unrelated-child"),
  link("production-child"),
  link("id-collision"),
  link("url-collision"),
], now);
assert.deepEqual(
  storedProjectionAudit.buckets.projection_repair_or_reviewed_source.map((row) => row.id),
  ["unrelated-child"],
);
assert.ok(storedProjectionAudit.buckets.published_media.some((row) => row.id === "already-published"));
assert.deepEqual(
  storedProjectionAudit.buckets.missing_source_or_replacement.map((row) => row.id),
  ["region-blocked", "dead", "pending-projection", "production-child", "id-collision", "url-collision"],
);
for (const id of ["region-blocked", "dead", "pending-projection", "production-child", "id-collision", "url-collision"]) {
  assert.ok(
    storedProjectionAudit.buckets.missing_source_or_replacement
      .find((row) => row.id === id)
      .reasons.includes("existing_publication_requires_revalidation"),
  );
}
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "region-blocked")
    .reasons.includes("stored_content_region_blocked"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "dead")
    .reasons.includes("stored_content_dead"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "pending-projection")
    .reasons.includes("stored_content_pending"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "production-child")
    .reasons.includes("stored_content_production_linked"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "id-collision")
    .reasons.includes("stored_content_platform_inconsistent"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "id-collision")
    .reasons.includes("stored_content_url_inconsistent"),
);
assert.ok(
  storedProjectionAudit.buckets.missing_source_or_replacement
    .find((row) => row.id === "url-collision")
    .reasons.includes("stored_content_identity_inconsistent"),
);

const mixedPublishedProjectionAudit = classifyDiscoveryAudit([
  videoMeme("live-with-unrelated-blocked", {
    meme_contents: [
      publishedContent({
        platform: "YouTube",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
      }),
      publishedContent({
        platform: "YouTube",
        content_id: "lmnopqrstuv",
        url: "https://www.youtube.com/watch?v=lmnopqrstuv",
        availability: "region_blocked",
      }),
    ],
  }),
  videoMeme("live-cross-platform-collision", {
    meme_contents: [publishedContent({ platform: "Instagram", url: null })],
  }),
], [
  link("live-with-unrelated-blocked"),
  link("live-with-unrelated-blocked", {
    source_id: "different-blocked-source",
    media_sources: source({
      external_id: "lmnopqrstuv",
      canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv",
    }),
  }),
  link("live-cross-platform-collision"),
], now);
assert.deepEqual(
  mixedPublishedProjectionAudit.buckets.published_media.map((row) => row.id),
  ["live-with-unrelated-blocked", "live-cross-platform-collision"],
);
assert.equal(mixedPublishedProjectionAudit.counts.missing_source_or_replacement, 0);
assert.equal(mixedPublishedProjectionAudit.counts.projection_repair_or_reviewed_source, 0);

for (const [badSource, expectedReason] of [
  [source({ public_status: "private" }), "confirmed_bad_source_private"],
  [source({ public_status: "unlisted" }), "confirmed_bad_source_unlisted"],
  [source({ removed_at: now.toISOString() }), "confirmed_bad_source_removed"],
  [source({ embeddable: false }), "confirmed_bad_source_unembeddable"],
]) {
  const badAudit = classifyDiscoveryAudit([
    videoMeme("bad-source", { meme_contents: [publishedContent()] }),
  ], [link("bad-source", { media_sources: badSource })], now);
  assert.deepEqual(badAudit.buckets.published_media, []);
  assert.ok(badAudit.buckets.missing_source_or_replacement[0].reasons.includes(expectedReason));
}

for (const [badSource, expectedReason] of [
  [source({ public_status: "private" }), "linked_source_private"],
  [source({ public_status: "unlisted" }), "linked_source_unlisted"],
  [source({ removed_at: now.toISOString() }), "linked_source_removed"],
  [source({ embeddable: false }), "linked_source_unembeddable"],
]) {
  const ledgerOnlyAudit = classifyDiscoveryAudit(
    [videoMeme("ledger-only")],
    [link("ledger-only", { media_sources: badSource })],
    now,
  );
  const [row] = ledgerOnlyAudit.buckets.missing_source_or_replacement;
  assert.ok(row.reasons.includes(expectedReason));
  assert.equal(row.reasons.some((reason) => reason.startsWith("confirmed_bad_source_")), false);
  assert.equal(row.reasons.includes("source_state_unknown_or_not_usable"), false);
}

const unknownLedgerAudit = classifyDiscoveryAudit(
  [videoMeme("unknown-ledger")],
  [link("unknown-ledger", {
    review_state: "rejected",
    rights_basis: "unknown",
    media_sources: source({ public_status: null, embeddable: null }),
  })],
  now,
);
assert.deepEqual(
  unknownLedgerAudit.buckets.missing_source_or_replacement[0].reasons,
  ["source_state_unknown_or_not_usable"],
);

const tiktokId = "1234567890123456789";
const instagramId = "AbCdE_f12";
const socialPrivateAudit = classifyDiscoveryAudit([
  videoMeme("tiktok-private", {
    meme_contents: [{
      ...publishedContent(), platform: "TikTok", content_id: tiktokId,
      url: `https://www.tiktok.com/@first/video/${tiktokId}`,
    }],
  }),
  videoMeme("instagram-private", {
    meme_contents: [{
      ...publishedContent(), platform: "Instagram", content_id: instagramId,
      url: `https://www.instagram.com/p/${instagramId}/`,
    }],
  }),
], [
  link("tiktok-private", {
    media_sources: source({
      platform: "tiktok", external_id: tiktokId,
      canonical_url: `https://www.tiktok.com/@different/video/${tiktokId}`,
      public_status: "private",
    }),
  }),
  link("instagram-private", {
    media_sources: source({
      platform: "instagram", external_id: instagramId,
      canonical_url: `https://www.instagram.com/reel/${instagramId}/`,
      public_status: "private",
    }),
  }),
], now);
assert.deepEqual(socialPrivateAudit.buckets.missing_source_or_replacement.map((row) => row.id), [
  "tiktok-private", "instagram-private",
]);
assert.ok(socialPrivateAudit.buckets.missing_source_or_replacement.every((row) => (
  row.reasons.includes("confirmed_bad_source_private")
)));

const unrelatedSocialAudit = classifyDiscoveryAudit([
  videoMeme("unrelated-social", { meme_contents: [publishedContent()] }),
], [
  link("unrelated-social", {
    media_sources: source({
      platform: "instagram", external_id: instagramId,
      canonical_url: `https://www.instagram.com/reel/${instagramId}/`,
      public_status: "private",
    }),
  }),
], now);
assert.deepEqual(unrelatedSocialAudit.buckets.published_media.map((row) => row.id), ["unrelated-social"]);
assert.ok(unrelatedSocialAudit.buckets.published_media[0].reasons.includes("linked_source_private"));
assert.equal(
  unrelatedSocialAudit.buckets.published_media[0].reasons.includes("confirmed_bad_source_private"),
  false,
);

const collapsedYouTubeAudit = classifyDiscoveryAudit([
  videoMeme("collapsed-youtube", { meme_contents: [publishedContent()] }),
], [
  link("collapsed-youtube", {
    media_sources: source({
      platform: "youtube", external_id: null,
      canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
      public_status: "private",
    }),
  }),
], now);
assert.ok(
  collapsedYouTubeAudit.buckets.missing_source_or_replacement[0]
    .reasons.includes("confirmed_bad_source_private"),
);

const inconsistentPublicationAudit = classifyDiscoveryAudit([
  videoMeme("inconsistent-publication", {
    meme_contents: [{
      ...publishedContent(), platform: "TikTok", content_id: tiktokId,
      url: "https://www.tiktok.com/@creator/video/9876543210987654321",
    }],
  }),
  videoMeme("invalid-playback-id", {
    meme_contents: [{
      ...publishedContent(), platform: "Instagram", content_id: "bad!",
      url: `https://www.instagram.com/reel/${instagramId}/`,
    }],
  }),
], [], now);
assert.deepEqual(inconsistentPublicationAudit.buckets.missing_source_or_replacement.map((row) => row.id), [
  "inconsistent-publication", "invalid-playback-id",
]);
assert.ok(inconsistentPublicationAudit.buckets.missing_source_or_replacement.every((row) => (
  row.reasons.includes("published_content_identity_inconsistent")
)));

const revalidationCases = [
  source({ metadata_refreshed_at: null }),
  source({ metadata_refreshed_at: new Date(now.getTime() - 31 * 86_400_000).toISOString() }),
  source({ metadata_refreshed_at: new Date(now.getTime() + 6 * 60_000).toISOString() }),
  source({ last_checked_at: new Date(now.getTime() + 6 * 60_000).toISOString() }),
  source({ metadata_expires_at: new Date(now.getTime() - 1).toISOString() }),
  source({ metadata_expires_at: new Date(now.getTime() + 31 * 86_400_000).toISOString() }),
  source({ canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv" }),
];
for (const [index, staleSource] of revalidationCases.entries()) {
  const revalidationAudit = classifyDiscoveryAudit(
    [videoMeme(`revalidation-${index}`)],
    [link(`revalidation-${index}`, { media_sources: staleSource })],
    now,
  );
  assert.equal(revalidationAudit.counts.projection_repair_or_reviewed_source, 0);
  assert.ok(
    revalidationAudit.buckets.missing_source_or_replacement[0]
      .reasons.includes("reviewed_source_needs_revalidation"),
  );
}

const missingClassificationAudit = classifyDiscoveryAudit([
  videoMeme("missing-category", { category: null }),
  videoMeme("missing-media-type", { media_type: null }),
], [], now);
assert.deepEqual(missingClassificationAudit.buckets["excluded/nonvisual"].map((row) => row.id), [
  "missing-category", "missing-media-type",
]);

const sanitizedAudit = classifyDiscoveryAudit(
  [videoMeme("sanitized", { title: "safe title" })],
  [link("sanitized", {
    source_id: "secret-source-id",
    media_sources: source(),
  })],
  now,
);
const sanitizedRow = sanitizedAudit.buckets.projection_repair_or_reviewed_source[0];
assert.deepEqual(Object.keys(sanitizedRow), ["id", "title", "category", "media_type", "reasons"]);
assert.doesNotMatch(JSON.stringify(sanitizedAudit), /secret-source-id|abcdefghijk/);

const auditReadCalls = [];
const transportedAudit = await runDiscoveryAudit({
  rest: async (path, init) => {
    auditReadCalls.push({ path, init });
    assert.equal(init, undefined);
    return [];
  },
  now,
});
assert.equal(auditReadCalls.length, 2);
assert.ok(auditReadCalls.every(({ path }) => !path.includes("radar_source_policies")));
assert.ok(auditReadCalls.every(({ path }) => path.includes("offset=0&limit=1000")));
assert.equal(transportedAudit.snapshotConsistency, "best_effort_nontransactional_two_query_snapshot");
assert.equal(transportedAudit.counts.missing_source_or_replacement, 0);

let loadedRoot = null;
const loadedEnv = await loadDiscoveryEnv({
  root: "/verified/project",
  loader: async ({ root }) => {
    loadedRoot = root;
    return {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "not-logged-test-secret",
    };
  },
});
assert.equal(loadedRoot, "/verified/project");
assert.equal(loadedEnv.SUPABASE_SERVICE_ROLE_KEY, "not-logged-test-secret");

assert.doesNotThrow(() => assertYouTubeRawOnlyPolicy([{
  policy_key: "youtube", platform: "youtube", enabled: true,
  derived_analysis_allowed: false, cross_platform_combination_allowed: false,
  verified_at: "2026-10-14T00:00:00Z",
}]));
assert.throws(() => assertYouTubeRawOnlyPolicy([]), /policy/i);
assert.throws(() => assertYouTubeRawOnlyPolicy([{
  policy_key: "youtube", platform: "youtube", enabled: true,
  derived_analysis_allowed: true, cross_platform_combination_allowed: false,
  verified_at: "2026-10-14T00:00:00Z",
}]), /raw-only/i);

const calls = [];
const rest = async (path, init) => { calls.push({ path, init }); return [{ id: "new-source" }]; };
const run = await runDiscovery({
  rest, memes: [videoMeme("missing"), videoMeme("error")], links: [],
  searchYouTube: async (meme) => meme.id === "missing" ? [candidate()] : Promise.reject(new Error("provider quota exhausted")),
  now, max: 2, delayMs: 0, wait: async () => {},
});
assert.equal(run.stats.searched, 2);
assert.equal(run.stats.apiRequests, 2);
assert.equal(run.stats.errors, 1);
assert.equal(run.stats.linked, 1);
assert.equal(calls.length, 2);
assert.match(calls[1].init.body, /"review_state":"pending"/);
assert.match(calls[1].init.body, /"rights_basis":"unknown"/);

const duplicate = await runDiscovery({
  rest: async () => { throw new Error("must not write duplicate"); },
  memes: [videoMeme("duplicate")], links: [link("duplicate", { review_state: "rejected" })],
  searchYouTube: async () => [candidate()], now, max: 1, wait: async () => {},
});
assert.equal(duplicate.stats.skippedExisting, 1);
assert.equal(duplicate.stats.linked, 0);

const zero = await runDiscovery({
  rest, memes: [videoMeme("zero")], links: [], searchYouTube: async () => [],
  now, max: 1, wait: async () => {},
});
assert.equal(zero.stats.zeroResults, 1);
assert.equal(zero.stats.linked, 0);

const dry = await runDiscovery({
  rest: async () => { throw new Error("dry-run must not write"); },
  memes: [videoMeme("dry")], links: [], searchYouTube: async () => [candidate()],
  now, max: 1, dryRun: true, wait: async () => {},
});
assert.equal(dry.stats.wouldLink, 1);
assert.equal(dry.stats.linked, 0);
assert.equal(dry.stats.replacementAbsent, 0);

const planned = await runDiscovery({
  rest: async () => { throw new Error("plan-only must not write"); },
  memes: [videoMeme("plan")], links: [],
  searchYouTube: async () => { throw new Error("plan-only must not call YouTube"); },
  now, max: 1, planOnly: true,
});
assert.deepEqual(planned.selected.map((meme) => meme.id), ["plan"]);
assert.equal(planned.stats.searched, 0);
assert.equal(planned.stats.apiRequests, 0);

const targetedPlan = await runDiscovery({
  rest: async () => { throw new Error("targeted plan must not write"); },
  memes: [videoMeme("before"), videoMeme(whiplashMemeId)],
  links: [],
  searchYouTube: async () => { throw new Error("targeted plan must not call YouTube"); },
  now,
  max: 1,
  planOnly: true,
  memeId: whiplashMemeId,
  channelId: "UCBSPgsi3DjJ0-EUEA-Spjug",
});
assert.deepEqual(targetedPlan.selected.map((meme) => meme.id), [whiplashMemeId]);
assert.equal(targetedPlan.stats.apiRequests, 0);

console.log("YouTube recovery discovery eligibility, publication suppression, channel filtering, bounds, and plan-only behavior OK");
