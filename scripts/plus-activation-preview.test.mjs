import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatTextReport,
  missingPreviewCredentials,
  parsePreviewArgs,
  runAccessBoundaryMatrix,
  validateBrowserArtifact,
  validatePreviewBoundary,
} from "./plus-activation-preview.mjs";

const manifest = {
  environment: "preview",
  appUrl: "https://memecatch-git-act001-preview.vercel.app",
  supabaseUrl: "https://act001-preview.supabase.co",
  runId: "act001-preview-run",
  commitSha: "a".repeat(40),
  memeId: "00000000-0000-0000-0000-000000000001",
  locale: "en",
  migrationLedger: {
    source: "artifacts/renewal/act-001/ledger.json",
    applied: ["20260817120000_growth_plan_p0.sql"],
  },
  payment: {
    provider: "unifi",
    mode: "test",
    verified: true,
    browserArtifact: {
      source: "browser.md",
      sha256: "b".repeat(64),
    },
    confirmed: {
      requestId: "MC-real-confirmed-001",
      providerLinkId: "LINK-real-confirmed-001",
      transactionId: "unifi-real-confirmed-001",
      status: "CONFIRMED",
    },
    receipt: {
      id: "10000000-0000-4000-8000-000000000001",
      channel: "threads",
      artifactKind: "creator_pack",
      mode: "one_cut",
      refreshReadBack: true,
    },
  },
};

const boundaryEnv = {
  ACT001_PREVIEW_APP_ORIGIN: manifest.appUrl,
  ACT001_PREVIEW_SUPABASE_ORIGIN: manifest.supabaseUrl,
  ACT001_PRODUCTION_APP_ORIGIN: "https://catchmeme.com",
  ACT001_PRODUCTION_SUPABASE_ORIGIN: "https://onjipuldngbdptldkpoe.supabase.co",
};

assert.deepEqual(parsePreviewArgs(["--manifest", "manifest.json", "--json"]), {
  help: false,
  json: true,
  manifest: "manifest.json",
});
assert.equal(parsePreviewArgs(["--help"]).help, true);
const textReport = formatTextReport({
  status: "READ_MATRIX_PASS",
  claims: { providerE2e: false, browserRefresh: false, analyticsDelivery: false },
});
assert.match(textReport, /ACT-001 preview READ_MATRIX_PASS/u);
assert.match(textReport, /providerE2e=false/u);
assert.match(textReport, /browserRefresh=false/u);
assert.match(textReport, /analyticsDelivery=false/u);
assert.match(textReport, /read-matrix-only/u);
assert.deepEqual(parsePreviewArgs(["--", "--manifest", "manifest.json", "--json"]), {
  help: false,
  json: true,
  manifest: "manifest.json",
});
assert.throws(() => parsePreviewArgs([]), /--manifest/);
assert.deepEqual(validatePreviewBoundary(manifest, boundaryEnv), []);
assert.ok(validatePreviewBoundary(manifest, {}).some((item) => (
  item.code === "ACT001_PRODUCTION_BOUNDARY_MISSING"
)));
assert.ok(validatePreviewBoundary({ ...manifest, payment: undefined }, boundaryEnv).some((item) => (
  item.code === "ACT001_REAL_PAYMENT_EVIDENCE_MISSING"
)));
assert.ok(validatePreviewBoundary(manifest, {
  ...boundaryEnv,
  ACT001_PRODUCTION_SUPABASE_ORIGIN: manifest.supabaseUrl,
}).some((item) => item.code === "ACT001_PRODUCTION_REFUSED"));
assert.ok(validatePreviewBoundary({ ...manifest, appUrl: "https://catchmeme.com" }, {
  ...boundaryEnv,
  ACT001_PREVIEW_APP_ORIGIN: "https://catchmeme.com",
  ACT001_PRODUCTION_APP_ORIGIN: "https://fake-production.example.test",
}).some((item) => item.code === "ACT001_PRODUCTION_REFUSED"));
assert.ok(validatePreviewBoundary({
  ...manifest,
  payment: {
    ...manifest.payment,
    confirmed: {
      ...manifest.payment.confirmed,
      providerLinkId: "act001-link-fake",
      transactionId: "act001-tx-fake",
    },
  },
}, boundaryEnv).some((item) => item.code === "ACT001_SYNTHETIC_TRANSACTION_REFUSED"));
assert.ok(validatePreviewBoundary({
  ...manifest,
  payment: {
    ...manifest.payment,
    refunded: {
      ...manifest.payment.confirmed,
      transactionId: "unifi-another-transaction",
      refundTransactionId: "unifi-real-refund-001",
      status: "REFUNDED",
    },
  },
}, boundaryEnv).some((item) => item.code === "ACT001_REFUND_TRANSACTION_MISMATCH"));

const missing = missingPreviewCredentials({});
assert.deepEqual(missing, [...missing].sort());
assert.equal(missing.length, 7);

let readLeak = null;
let refundRpcAllowed = false;
const boundaryServer = createServer((request, response) => {
  if (request.method === "POST" && request.url === "/rest/v1/rpc/reconcile_unifi_refund") {
    response.writeHead(refundRpcAllowed ? 200 : 403, { "content-type": "application/json" });
    response.end(refundRpcAllowed ? '{"status":"unexpected"}' : '{"message":"permission denied for function reconcile_unifi_refund"}');
    return;
  }
  const token = request.headers.authorization?.replace("Bearer ", "");
  const isLeak = (readLeak === "signed-out-billing"
      && token === "anon-key"
      && request.url?.startsWith("/rest/v1/billing_orders?"))
    || (readLeak === "signed-out-receipt"
      && token === "anon-key"
      && request.url?.startsWith("/rest/v1/plus_meme_use_receipts?"))
    || (readLeak === "cross-owner-order"
      && token === "cross-owner-jwt"
      && request.url?.startsWith("/rest/v1/billing_orders?"));
  const rows = isLeak ? [{ id: "leaked-row" }] : [];
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(rows));
});
await new Promise((resolve, reject) => {
  boundaryServer.once("error", reject);
  boundaryServer.listen(0, "127.0.0.1", resolve);
});
try {
  const address = boundaryServer.address();
  assert.ok(address && typeof address === "object");
  const boundaryInput = {
    context: {
      baseUrl: `http://127.0.0.1:${address.port}`,
      anonKey: "anon-key",
      serviceKey: "service-key",
    },
    manifest,
    owner: "owner-jwt",
    crossOwner: "cross-owner-jwt",
  };
  assert.deepEqual(await runAccessBoundaryMatrix(boundaryInput), {
    signedOutBillingReadDenied: true,
    signedOutReceiptReadDenied: true,
    crossOwnerBillingOrderReadDenied: true,
    authenticatedRefundRpcDenied: true,
    runId: manifest.runId,
    commitSha: manifest.commitSha,
  });
  readLeak = "signed-out-billing";
  await assert.rejects(runAccessBoundaryMatrix(boundaryInput), /signed-out billing order read did not fail closed/u);
  readLeak = "signed-out-receipt";
  await assert.rejects(runAccessBoundaryMatrix(boundaryInput), /signed-out receipt read did not fail closed/u);
  readLeak = "cross-owner-order";
  await assert.rejects(runAccessBoundaryMatrix(boundaryInput), /cross-owner billing order read did not fail closed/u);
  readLeak = null;
  refundRpcAllowed = true;
  await assert.rejects(runAccessBoundaryMatrix(boundaryInput), /authenticated principal can reach the refund RPC/u);
} finally {
  await new Promise((resolve, reject) => boundaryServer.close((error) => (error ? reject(error) : resolve())));
}

const source = readFileSync(new URL("./plus-activation-preview.mjs", import.meta.url), "utf8");
for (const contract of [
  "billing_orders",
  "billing_subscriptions",
  "billing_webhook_events",
  "record_plus_meme_use_receipt",
  "receipt_conflict",
  "CANCELED",
  "REFUNDED",
]) {
  assert.match(source, new RegExp(contract));
}
assert.doesNotMatch(source, /vi\.mock|mockResolvedValue|mockRejectedValue/u);
assert.doesNotMatch(source, /process_unifi_order_event|act001-link-|act001-tx-/u);
assert.match(source, /"reconcile_unifi_refund", owner/u);
assert.doesNotMatch(source, /status:\s*"PASS"/u);

function runCli(path, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/plus-activation-preview.mjs",
      "--manifest",
      path,
      "--json",
    ], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const root = mkdtempSync(join(tmpdir(), "act001-preview-test-"));
try {
  const previewPath = join(root, "preview.json");
  const browserContent = "# ACT-001 browser evidence\n\nRedacted real Unifi test checkout evidence.\n";
  writeFileSync(join(root, "browser.md"), browserContent);
  const cliManifest = {
    ...manifest,
    payment: {
      ...manifest.payment,
      browserArtifact: {
        source: "browser.md",
        sha256: createHash("sha256").update(browserContent).digest("hex"),
      },
    },
  };
  assert.deepEqual(validateBrowserArtifact(cliManifest, root), []);
  assert.ok(validateBrowserArtifact({
    ...cliManifest,
    payment: {
      ...cliManifest.payment,
      browserArtifact: { source: "browser.md", sha256: "0".repeat(64) },
    },
  }, root).some((item) => item.code === "ACT001_BROWSER_EVIDENCE_INVALID"));
  writeFileSync(previewPath, JSON.stringify(cliManifest));
  const blocked = await runCli(previewPath, {
    ...boundaryEnv,
    ACT001_PREVIEW_SUPABASE_ANON_KEY: "do-not-print-this-partial-secret",
  });
  assert.equal(blocked.status, 1);
  const blockedReport = JSON.parse(blocked.stdout);
  assert.equal(blockedReport.status, "BLOCKED");
  assert.equal(blockedReport.redacted, true);
  assert.ok(blockedReport.blockers.every((item) => (
    Object.keys(item).join(",") === "code,stage,message,nextAction,retryable"
  )));
  assert.doesNotMatch(`${blocked.stdout}\n${blocked.stderr}`, /do-not-print-this-partial-secret/u);

  const productionPath = join(root, "production.json");
  writeFileSync(productionPath, JSON.stringify({ ...cliManifest, appUrl: "https://catchmeme.com" }));
  const refused = await runCli(productionPath, {
    ...boundaryEnv,
    ACT001_PREVIEW_APP_ORIGIN: "https://catchmeme.com",
  });
  assert.equal(refused.status, 1);
  assert.ok(JSON.parse(refused.stdout).blockers.some((item) => item.code === "ACT001_PRODUCTION_REFUSED"));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("plus-activation-preview contract tests passed");
