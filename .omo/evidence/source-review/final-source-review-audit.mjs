#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createRestClient, restAll } from "../../../scripts/source-pipeline-rest.mjs";

const values = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.join("=")];
  }),
);
const since = values.get("--since");
const expectedAudits = Number(values.get("--expected-audits"));
const expectedApproved = Number(values.get("--expected-approved"));
const expectedRejected = Number(values.get("--expected-rejected"));
const keysFile = process.env.KEYS_FILE;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!since || !keysFile || !Number.isInteger(expectedAudits)) {
  throw new Error("--since, --expected-audits, --expected-approved, --expected-rejected and KEYS_FILE are required");
}
if (!supabaseUrl?.includes("onjipuldngbdptldkpoe")) {
  throw new Error("refusing non-production or unexpected Supabase project");
}

const keyRows = JSON.parse(readFileSync(keysFile, "utf8"));
const serviceRole = keyRows.find((row) => row.id === "service_role" || row.name === "service_role");
const serviceKey = serviceRole?.api_key ?? serviceRole?.apiKey ?? serviceRole?.key;
if (!serviceKey) throw new Error("service_role key not found");

const rest = createRestClient({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
});
const audits = await restAll(
  rest,
  `admin_audit_log?select=action,entity_id,detail,created_at&created_at=gte.${encodeURIComponent(since)}&detail->>agent_review=eq.true&order=created_at.asc`,
);
if (audits.length !== expectedAudits) {
  throw new Error(`audit count mismatch: expected ${expectedAudits}, got ${audits.length}`);
}

const auditByEntity = new Map();
for (const audit of audits) {
  if (!['source.approve', 'source.reject'].includes(audit.action) || !audit.entity_id) {
    throw new Error(`unexpected audit action or entity: ${audit.action}`);
  }
  if (auditByEntity.has(audit.entity_id)) throw new Error(`duplicate audit entity ${audit.entity_id}`);
  auditByEntity.set(audit.entity_id, audit);
}

const reviewed = await restAll(
  rest,
  `meme_media?select=meme_id,source_id,review_state,source_role,rights_basis,reviewer_note,reviewed_at,media_sources(platform,external_id,canonical_url,embeddable,removed_at)&reviewed_at=gte.${encodeURIComponent(since)}`,
);
const rows = reviewed.filter((row) => auditByEntity.has(`${row.meme_id}:${row.source_id}`));
if (rows.length !== audits.length) throw new Error(`ledger/audit cardinality mismatch: ${rows.length}/${audits.length}`);

const approved = [];
const rejected = [];
for (const row of rows) {
  const audit = auditByEntity.get(`${row.meme_id}:${row.source_id}`);
  if (audit.action === "source.approve") {
    if (row.review_state !== "approved") throw new Error(`approval state mismatch ${audit.entity_id}`);
    if (!row.source_role || !row.rights_basis || ['unknown', 'blocked'].includes(row.rights_basis)) {
      throw new Error(`invalid approved trust fields ${audit.entity_id}`);
    }
    if (!row.media_sources?.embeddable || row.media_sources.removed_at || !row.media_sources.external_id) {
      throw new Error(`invalid approved media state ${audit.entity_id}`);
    }
    approved.push(row);
  } else {
    if (row.review_state !== "rejected" || !row.reviewer_note?.trim()) {
      throw new Error(`rejection state mismatch ${audit.entity_id}`);
    }
    rejected.push(row);
  }
}
if (approved.length !== expectedApproved || rejected.length !== expectedRejected) {
  throw new Error(`decision count mismatch: approved ${approved.length}, rejected ${rejected.length}`);
}

async function fetchByMemeIds(tablePath, memeIds) {
  const result = [];
  const uniqueIds = [...new Set(memeIds)];
  for (let index = 0; index < uniqueIds.length; index += 40) {
    const chunk = uniqueIds.slice(index, index + 40);
    result.push(...await restAll(rest, `${tablePath}&meme_id=in.(${chunk.join(",")})`));
  }
  return result;
}

const DISPLAY_PLATFORM = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};
const allMemeIds = rows.map((row) => row.meme_id);
const publicSources = await fetchByMemeIds(
  "meme_sources?select=meme_id,source_url,source_role,rights_basis,copyright_status",
  allMemeIds,
);
const publicContents = await fetchByMemeIds(
  "meme_contents?select=meme_id,platform,content_id,availability,moderation_status&type=eq.embed",
  approved.map((row) => row.meme_id),
);

let approvedSourceProjections = 0;
let approvedContentProjections = 0;
for (const row of approved) {
  const source = row.media_sources;
  const sourceMatch = publicSources.some(
    (item) =>
      item.meme_id === row.meme_id &&
      item.source_url === source.canonical_url &&
      item.source_role === row.source_role &&
      item.rights_basis === row.rights_basis &&
      item.copyright_status === "embeddable",
  );
  if (!sourceMatch) throw new Error(`approved public source missing ${row.meme_id}:${row.source_id}`);
  approvedSourceProjections += 1;

  const contentMatch = publicContents.some(
    (item) =>
      item.meme_id === row.meme_id &&
      item.platform === DISPLAY_PLATFORM[source.platform] &&
      item.content_id === source.external_id &&
      item.availability === "live" &&
      item.moderation_status === "approved",
  );
  if (!contentMatch) throw new Error(`approved public content missing ${row.meme_id}:${row.source_id}`);
  approvedContentProjections += 1;
}

const rejectedPublicProjections = rejected.filter((row) =>
  publicSources.some(
    (item) => item.meme_id === row.meme_id && item.source_url === row.media_sources?.canonical_url,
  ),
);
if (rejectedPublicProjections.length) {
  throw new Error(`${rejectedPublicProjections.length} rejected pairs have a public source projection`);
}

const pending = await restAll(rest, "meme_media?select=meme_id,source_id&review_state=eq.pending");
if (pending.length) throw new Error(`${pending.length} pending candidates remain`);

const byPlatform = {};
for (const row of rows) {
  const platform = row.media_sources?.platform ?? "missing";
  byPlatform[platform] ??= { approved: 0, rejected: 0 };
  byPlatform[platform][row.review_state] += 1;
}

console.log(JSON.stringify({
  since,
  pending_rows: pending.length,
  audit_rows: audits.length,
  approved_rows: approved.length,
  rejected_rows: rejected.length,
  approved_source_projections: approvedSourceProjections,
  approved_content_projections: approvedContentProjections,
  rejected_public_projections: rejectedPublicProjections.length,
  by_platform: byPlatform,
}, null, 2));
