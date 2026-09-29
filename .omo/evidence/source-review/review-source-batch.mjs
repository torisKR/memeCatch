#!/usr/bin/env node

import { basename } from "node:path";
import { readFileSync } from "node:fs";
import { createRestClient } from "../../../scripts/source-pipeline-rest.mjs";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);
const decisionsPath = args.get("--decisions");
const assignmentPath = args.get("--assignment");
const mode = args.get("--mode") ?? "preflight";
const confirmed = args.has("--confirmed-operator-review");
const keysFile = process.env.KEYS_FILE;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (typeof decisionsPath !== "string") throw new Error("--decisions=<path> is required");
if (!['preflight', 'apply'].includes(mode)) throw new Error("--mode must be preflight or apply");
if (mode === "apply" && !confirmed) throw new Error("apply requires --confirmed-operator-review");
if (!keysFile) throw new Error("KEYS_FILE is required");
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
const decisions = JSON.parse(readFileSync(decisionsPath, "utf8"));
if (!Array.isArray(decisions) || decisions.length === 0) throw new Error("decisions must be a non-empty array");
if (typeof assignmentPath === "string") {
  const assignments = JSON.parse(readFileSync(assignmentPath, "utf8"));
  const assignedIds = assignments.map((item) => item.meme_id).sort();
  const decidedIds = decisions.map((item) => item.meme_id).sort();
  if (
    assignedIds.length !== decidedIds.length ||
    assignedIds.some((id, index) => id !== decidedIds[index])
  ) {
    throw new Error("decision meme IDs do not exactly match assignment");
  }
}

const SOURCE_ROLES = new Set([
  "original",
  "official_reupload",
  "earliest_known",
  "secondary_reference",
  "usage_example",
]);
const DISPLAY_PLATFORM = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

const memeIds = decisions.map((decision) => decision.meme_id);
if (new Set(memeIds).size !== memeIds.length) throw new Error("duplicate meme_id in decisions");

const selectedIds = decisions.flatMap((decision) => decision.approve ? [decision.approve.source_id] : []);
if (new Set(selectedIds).size !== selectedIds.length) throw new Error("one source_id is selected for multiple memes");

for (const decision of decisions) {
  if (!decision.meme_id || !decision.title || !decision.reject_note?.trim()) {
    throw new Error(`invalid decision shape for ${decision.meme_id ?? "unknown"}`);
  }
  if (decision.reviewed_source_ids !== undefined) {
    if (!Array.isArray(decision.reviewed_source_ids)) {
      throw new Error(`reviewed_source_ids must be an array for ${decision.meme_id}`);
    }
    if (new Set(decision.reviewed_source_ids).size !== decision.reviewed_source_ids.length) {
      throw new Error(`duplicate reviewed_source_ids for ${decision.meme_id}`);
    }
  }
  if (decision.approve) {
    if (!SOURCE_ROLES.has(decision.approve.source_role)) throw new Error(`invalid source_role for ${decision.meme_id}`);
    if (decision.approve.rights_basis !== "official_embed") throw new Error(`only official_embed is allowed for ${decision.meme_id}`);
    if (!decision.approve.note?.trim()) throw new Error(`approval note missing for ${decision.meme_id}`);
  }
}

const idFilter = memeIds.join(",");
const select = [
  "meme_id",
  "source_id",
  "review_state",
  "source_role",
  "rights_basis",
  "reviewer_note",
  "reviewed_at",
  "media_sources(id,platform,external_id,canonical_url,title,channel_name,embeddable,removed_at,thumbnail_url)",
  "memes(title)",
].join(",");

async function loadRows() {
  return rest(`meme_media?select=${select}&meme_id=in.(${idFilter})`);
}

const allRows = await loadRows();
const pendingRows = allRows.filter((row) => row.review_state === "pending");
const rowsByMeme = Map.groupBy(pendingRows, (row) => row.meme_id);
const liveEvidence = [];

function normalizedTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

for (const decision of decisions) {
  const rows = rowsByMeme.get(decision.meme_id) ?? [];
  if (decision.reviewed_source_ids !== undefined) {
    const expected = [...decision.reviewed_source_ids].sort();
    const current = rows.map((row) => row.source_id).sort();
    if (expected.length !== current.length || expected.some((id, index) => id !== current[index])) {
      throw new Error(`pending candidate set changed for ${decision.meme_id}`);
    }
  }
  const dbTitle = rows[0]?.memes?.title ?? allRows.find((row) => row.meme_id === decision.meme_id)?.memes?.title;
  if (dbTitle && normalizedTitle(dbTitle) !== normalizedTitle(decision.title)) {
    throw new Error(`title mismatch for ${decision.meme_id}: ${dbTitle}`);
  }
  if (!decision.approve) continue;

  const selected = rows.find((row) => row.source_id === decision.approve.source_id);
  if (!selected) throw new Error(`selected source is not currently pending for ${decision.meme_id}`);
  const source = selected.media_sources;
  if (!source) throw new Error(`selected source metadata missing for ${decision.meme_id}`);
  if (source.removed_at) throw new Error(`selected source was removed for ${decision.meme_id}`);
  if (source.embeddable !== true) throw new Error(`selected source is not embeddable for ${decision.meme_id}`);
  if (!source.external_id) throw new Error(`selected source has no external_id for ${decision.meme_id}`);
  if (!DISPLAY_PLATFORM[source.platform]) throw new Error(`unsupported platform for ${decision.meme_id}`);

  let remote = { ok: true, title: source.title, author_name: source.channel_name };
  if (source.platform === "youtube" || source.platform === "youtube_shorts") {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(source.canonical_url)}&format=json`);
    if (!response.ok) throw new Error(`YouTube oEmbed ${response.status} for ${decision.meme_id}`);
    remote = await response.json();
  }
  liveEvidence.push({
    meme_id: decision.meme_id,
    title: decision.title,
    source_id: source.id,
    platform: source.platform,
    live_title: remote.title ?? null,
    live_author: remote.author_name ?? null,
    source_role: decision.approve.source_role,
  });
}

const preflight = {
  batch: basename(decisionsPath),
  decisions: decisions.length,
  groups_with_no_current_pending: decisions.filter((decision) => !(rowsByMeme.get(decision.meme_id)?.length)).map((decision) => decision.meme_id),
  pending_rows: pendingRows.length,
  approve_rows: selectedIds.length,
  reject_rows: pendingRows.length - selectedIds.length,
  live_evidence: liveEvidence,
};

if (mode === "preflight") {
  console.log(JSON.stringify({ mode, ...preflight }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const runId = `agent-source-review:${basename(decisionsPath, ".json")}:${now}`;
const touchedEntityIds = [];

async function patchOne(path, body) {
  const updated = await rest(path, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!Array.isArray(updated) || updated.length !== 1) throw new Error(`expected one updated row: ${path}`);
}

async function ensurePublicProjection(row, approval) {
  const source = row.media_sources;
  const displayPlatform = DISPLAY_PLATFORM[source.platform];
  const sourcePath = `meme_sources?select=id&meme_id=eq.${row.meme_id}&source_url=eq.${encodeURIComponent(source.canonical_url)}`;
  const existingSources = await rest(sourcePath);
  const publicSourceBody = {
    platform: displayPlatform,
    source_url: source.canonical_url,
    title: source.title,
    creator_name: source.channel_name,
    copyright_status: "embeddable",
    source_role: approval.source_role,
    rights_basis: approval.rights_basis,
  };
  if (existingSources.length) {
    await patchOne(`meme_sources?id=eq.${existingSources[0].id}`, publicSourceBody);
  } else {
    await rest("meme_sources", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ meme_id: row.meme_id, ...publicSourceBody }),
    });
  }

  const contentPath = `meme_contents?select=id&meme_id=eq.${row.meme_id}&type=eq.embed&platform=eq.${encodeURIComponent(displayPlatform)}&content_id=eq.${encodeURIComponent(source.external_id)}`;
  const existingContents = await rest(contentPath);
  const contentBody = {
    url: source.canonical_url,
    thumbnail_url: source.thumbnail_url,
    caption: source.title,
    availability: "live",
    moderation_status: "approved",
  };
  if (existingContents.length) {
    await patchOne(`meme_contents?id=eq.${existingContents[0].id}`, contentBody);
  } else {
    await rest("meme_contents", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        meme_id: row.meme_id,
        type: "embed",
        platform: displayPlatform,
        content_id: source.external_id,
        is_representative: false,
        ...contentBody,
      }),
    });
  }
}

async function writeAudit(action, row, detail) {
  const entityId = `${row.meme_id}:${row.source_id}`;
  await rest("admin_audit_log", {
    method: "POST",
    body: JSON.stringify({
      action,
      entity_type: "meme_media",
      entity_id: entityId,
      detail: { ...detail, agent_review: true, run_id: runId },
    }),
  });
  touchedEntityIds.push(entityId);
}

for (const decision of decisions) {
  const rows = rowsByMeme.get(decision.meme_id) ?? [];
  for (const row of rows) {
    const selected = decision.approve?.source_id === row.source_id;
    if (selected) {
      await patchOne(
        `meme_media?meme_id=eq.${row.meme_id}&source_id=eq.${row.source_id}&review_state=eq.pending`,
        {
          review_state: "approved",
          source_role: decision.approve.source_role,
          rights_basis: decision.approve.rights_basis,
          reviewer_note: decision.approve.note,
          reviewed_at: now,
        },
      );
      await ensurePublicProjection(row, decision.approve);
      await writeAudit("source.approve", row, {
        source_role: decision.approve.source_role,
        rights_basis: decision.approve.rights_basis,
        note: decision.approve.note,
      });
    } else {
      await patchOne(
        `meme_media?meme_id=eq.${row.meme_id}&source_id=eq.${row.source_id}&review_state=eq.pending`,
        { review_state: "rejected", reviewer_note: decision.reject_note, reviewed_at: now },
      );
      await writeAudit("source.reject", row, { note: decision.reject_note });
    }
  }
}

const readBack = await loadRows();
const remainingPending = readBack.filter((row) => row.review_state === "pending");
if (remainingPending.length) throw new Error(`${remainingPending.length} pending rows remain in reviewed groups`);

for (const decision of decisions.filter((item) => item.approve)) {
  const approved = readBack.find(
    (row) => row.meme_id === decision.meme_id && row.source_id === decision.approve.source_id,
  );
  if (
    approved?.review_state !== "approved" ||
    approved.source_role !== decision.approve.source_role ||
    approved.rights_basis !== decision.approve.rights_basis
  ) {
    throw new Error(`approved ledger read-back failed for ${decision.meme_id}`);
  }
  const source = approved.media_sources;
  const publicSources = await rest(
    `meme_sources?select=id,source_role,rights_basis,copyright_status&meme_id=eq.${decision.meme_id}&source_url=eq.${encodeURIComponent(source.canonical_url)}`,
  );
  if (
    !publicSources.some(
      (row) =>
        row.source_role === decision.approve.source_role &&
        row.rights_basis === decision.approve.rights_basis &&
        row.copyright_status === "embeddable",
    )
  ) {
    throw new Error(`public source read-back failed for ${decision.meme_id}`);
  }
  const displayPlatform = DISPLAY_PLATFORM[source.platform];
  const contents = await rest(
    `meme_contents?select=id,availability,moderation_status&meme_id=eq.${decision.meme_id}&type=eq.embed&platform=eq.${encodeURIComponent(displayPlatform)}&content_id=eq.${encodeURIComponent(source.external_id)}`,
  );
  if (!contents.some((row) => row.availability === "live" && row.moderation_status === "approved")) {
    throw new Error(`public content read-back failed for ${decision.meme_id}`);
  }
}

const audits = await rest(
  `admin_audit_log?select=entity_id,action&detail->>run_id=eq.${encodeURIComponent(runId)}&limit=${touchedEntityIds.length + 1}`,
);
if (audits.length !== touchedEntityIds.length) {
  throw new Error(`audit read-back failed: expected ${touchedEntityIds.length}, got ${audits.length}`);
}

console.log(JSON.stringify({
  mode,
  ...preflight,
  run_id: runId,
  read_back: {
    pending_rows: remainingPending.length,
    approved_rows: selectedIds.length,
    rejected_rows: pendingRows.length - selectedIds.length,
    audit_rows: audits.length,
  },
}, null, 2));
