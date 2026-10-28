import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DECISIONS = ["video_demonstration_priority", "context_media_optional", "hold_content_identity"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVIDENCE_FIELDS = ["title", "summary", "description", "origin", "usage_note"];

// Offline integrity check, not factual validation, semantic approval or execution.
// No database, provider, environment loading, network, AI or publication operation.
export function validateReviewBatches(snapshot, batches) {
  if (!Array.isArray(snapshot?.rows) || snapshot.rows.length === 0 ||
      snapshot.productionWrites !== 0 || snapshot.providerDataApiCalls !== 0) {
    throw new Error("Invalid read-only input snapshot");
  }
  const identities = new Set();
  for (const row of snapshot.rows) {
    if (!UUID.test(row.id) || identities.has(row.id) || !row.short_id || !row.title) {
      throw new Error("Invalid or duplicated snapshot identity");
    }
    identities.add(row.id);
  }
  if (!Array.isArray(batches) || batches.length === 0) throw new Error("Missing review batches");
  const visited = new Set();
  const counts = Object.fromEntries(DECISIONS.map(decision => [decision, 0]));
  for (const batch of batches) {
    if (batch.kind !== "local_editorial_review_proposal_not_approval" ||
        batch.productionWrites !== 0 || batch.providerCalls !== 0 ||
        !Array.isArray(batch.indexRange) || batch.indexRange.length !== 2 ||
        !Array.isArray(batch.rows)) throw new Error("Invalid proposal boundaries");
    const [start, end] = batch.indexRange;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
        end < start || end >= snapshot.rows.length || batch.rows.length !== end - start + 1) {
      throw new Error("Invalid proposal range or count");
    }
    for (let index = start; index <= end; index++) {
      const source = snapshot.rows[index];
      const row = batch.rows[index - start];
      if (row.id !== source.id || row.shortId !== source.short_id || row.title !== source.title || visited.has(row.id)) {
        throw new Error("Missing, duplicated or mismatched review identity");
      }
      if (!DECISIONS.includes(row.decision) || row.operatorApproved !== false ||
          typeof row.rationale !== "string" || !row.rationale.trim() ||
          typeof row.nextReview !== "string" || !row.nextReview.trim()) {
        throw new Error("Invalid decision or approval boundary");
      }
      if (typeof row.evidencePhrase !== "string" || !row.evidencePhrase.trim() ||
          !EVIDENCE_FIELDS.some(field => typeof source[field] === "string" && source[field].includes(row.evidencePhrase))) {
        throw new Error("Evidence phrase is not an exact stored-content excerpt");
      }
      visited.add(row.id);
      counts[row.decision]++;
    }
  }
  if (visited.size !== snapshot.rows.length) throw new Error("Incomplete review coverage");
  return { reviewedRows: visited.size, counts, productionWrites: 0, providerCalls: 0, operatorApprovals: 0 };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [snapshotPath, ...batchPaths] = process.argv.slice(2);
  if (!snapshotPath || batchPaths.length === 0) {
    throw new Error("Usage: node scripts/validate-media-classification-review.mjs SNAPSHOT BATCH...");
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const batches = batchPaths.map(path => {
    const batch = JSON.parse(readFileSync(path, "utf8"));
    if (resolve(batch.inputSnapshot) !== resolve(snapshotPath) &&
        resolve(snapshotPath).split("/").pop() !== batch.inputSnapshot) {
      throw new Error("Review references a different input snapshot");
    }
    return batch;
  });
  console.log(JSON.stringify(validateReviewBatches(snapshot, batches), null, 2));
}
