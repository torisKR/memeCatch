import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUTHENTICATED_RPCS,
  CORE_ACCESS_RELATIONS,
  CORE_RELATIONS,
  CORE_RPCS,
  REQUIRED_MIGRATIONS,
  SERVICE_ROLE_RPCS,
  classifyRelationProbe,
  evaluateActivationPreflight,
  normalizeBaseUrl,
  missingEnvironment,
  parseCliArgs,
  runPreflight,
  validateClosureContinuity,
  validateReleaseEvidence,
} from "./plus-activation-preflight.mjs";

const RELEASE_SHA = "a".repeat(40);
const PREVIEW_TARGET = "https://preview.example.test";
const PREVIEW_SUPABASE_REF = "b".repeat(20);
const PREVIEW_SUPABASE_ORIGIN = `https://${PREVIEW_SUPABASE_REF}.supabase.co`;
const EVIDENCE_TIMESTAMP = new Date().toISOString();
const evidenceRoot = mkdtempSync(join(tmpdir(), "memecatch-loop-130-"));
mkdirSync(join(evidenceRoot, "artifacts"), { recursive: true });
const artifact = (name, content = `${name}:${EVIDENCE_TIMESTAMP}`) => {
  const source = join("artifacts", name);
  const filePath = join(evidenceRoot, source);
  writeFileSync(filePath, content);
  return {
    source,
    sha256: createHash("sha256").update(content).digest("hex"),
    verifiedAt: EVIDENCE_TIMESTAMP,
  };
};
const releaseArtifact = artifact("release.json");
const paymentArtifact = artifact("payment.json");
const browserArtifact = artifact("browser.md");
const analyticsArtifact = artifact("analytics-privacy.json");
const privacyArtifact = artifact("privacy.json");
const migrationArtifact = artifact("migrations.json");
const accessBoundaryResult = {
  status: "READ_MATRIX_PASS",
  stage: "preview",
  provider: "unifi",
  environment: "preview",
  runId: "act001-test-run",
  commitSha: RELEASE_SHA,
  matrix: [
    "signed-out-billing-read-denied",
    "signed-out-receipt-read-denied",
    "cross-owner-billing-order-read-denied",
    "authenticated-refund-rpc-denied",
  ],
  claims: {
    providerE2e: false,
    browserRefresh: false,
    analyticsDelivery: false,
  },
  accessBoundary: {
    signedOutBillingReadDenied: true,
    signedOutReceiptReadDenied: true,
    crossOwnerBillingOrderReadDenied: true,
    authenticatedRefundRpcDenied: true,
    runId: "act001-test-run",
    commitSha: RELEASE_SHA,
  },
  redacted: true,
};
const accessBoundaryArtifact = artifact("access-boundary.json", JSON.stringify(accessBoundaryResult));
const arbitraryAccessBoundaryArtifact = artifact("arbitrary-access-boundary.txt", "hashed but not runner JSON");

assert.equal(normalizeBaseUrl("https://example.test/"), "https://example.test");
assert.equal(normalizeBaseUrl("http://127.0.0.1:3100/path".replace("/path", "/")), "http://127.0.0.1:3100");
assert.throws(() => normalizeBaseUrl("https://example.test?token=secret"), /query parameters/);
assert.throws(() => normalizeBaseUrl("https://example.test/path"), /without a path/);
assert.throws(() => normalizeBaseUrl("http://example.test"), /https unless it targets loopback/);
assert.throws(() => normalizeBaseUrl("file:///tmp/target"), /http or https/);

assert.equal(classifyRelationProbe({ status: 200, body: "[]" }), "available");
assert.equal(classifyRelationProbe({ status: 401, body: "permission denied" }), "unknown");
assert.equal(classifyRelationProbe({ status: 403, body: "permission denied" }), "unknown");
assert.equal(
  classifyRelationProbe({ status: 404, body: '{"code":"PGRST205","message":"relation does not exist"}' }),
  "missing",
);
assert.equal(classifyRelationProbe({ status: 500, body: "upstream" }), "unknown");
assert.ok(CORE_RELATIONS.includes("billing_orders"));
assert.ok(!CORE_RELATIONS.includes("billing_unifi_payments"));
assert.ok(!CORE_RPCS.includes("create_unifi_payment_intent"));
assert.ok(REQUIRED_MIGRATIONS.includes("20260810100000_plus_meme_use_receipt_integrity.sql"));
assert.ok(REQUIRED_MIGRATIONS.includes("20260831100000_plus_one_cut_trust_foundation.sql"));
assert.ok(REQUIRED_MIGRATIONS.includes("20260831101000_plus_one_cut_trust_enforcement.sql"));
assert.ok(REQUIRED_MIGRATIONS.every((migration) => !/latpeed|legacy/iu.test(migration)));

const rawEvidence = {
  runId: "act001-test-run",
  environment: "preview",
  target: PREVIEW_TARGET,
  supabase: { origin: PREVIEW_SUPABASE_ORIGIN, ref: PREVIEW_SUPABASE_REF },
  commitSha: RELEASE_SHA,
  workingTree: "clean",
  evidence: releaseArtifact,
  payment: {
    provider: "unifi",
    mode: "test",
    verified: true,
    e2e: ["payment", "entitlement", "eligible_action", "receipt", "outcome"],
    artifact: browserArtifact,
    matrix: {
      runId: "act001-test-run",
      commitSha: RELEASE_SHA,
      confirmedRealPayment: true,
      entitlementExactlyOnce: true,
      entitlementCount: 1,
      eligibleTrustedAction: true,
      duplicateWebhook: true,
      duplicateWebhookEventCount: 1,
      mismatchDenied: true,
      freeDenied: true,
      expiredDenied: true,
      crossOwnerDenied: true,
      receiptConflictDenied: true,
      receipt: { mode: "one_cut", refreshReadBack: true },
      confirmed: {
        provider: "unifi",
        mode: "test",
        status: "CONFIRMED",
        providerLinkId: "LINK-real-provider-001",
        transactionId: "unifi-real-transaction-001",
      },
      refund: {
        classification: "provider_refunded",
        outcome: "REFUNDED",
        verified: true,
        originalTransactionId: "unifi-real-transaction-001",
        refundTransactionId: "unifi-real-refund-001",
      },
      accessBoundary: {
        signedOutBillingReadDenied: true,
        signedOutReceiptReadDenied: true,
        crossOwnerBillingOrderReadDenied: true,
        authenticatedRefundRpcDenied: true,
        runId: "act001-test-run",
        commitSha: RELEASE_SHA,
        artifact: accessBoundaryArtifact,
      },
      artifact: paymentArtifact,
    },
    providerReview: {
      reviewed: true,
      reviewerRole: "operator",
      verifiedAt: EVIDENCE_TIMESTAMP,
      artifact: browserArtifact,
    },
  },
  privacy: {
    reviewed: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
    artifact: privacyArtifact,
  },
  migrations: {
    source: join("artifacts", "migrations.json"),
    applied: [...REQUIRED_MIGRATIONS],
    artifact: migrationArtifact,
  },
  analyticsPrivacy: {
    rawQueryAbsent: true,
    analyticsDeliveryVerified: true,
    artifact: analyticsArtifact,
  },
};
const validEvidence = validateReleaseEvidence(rawEvidence, { target: PREVIEW_TARGET, root: evidenceRoot });
assert.equal(validEvidence.valid, true);
assert.equal(validEvidence.migrationLedger.valid, true);
assert.equal(validEvidence.privacyReviewed, true);

const incompleteClosure = validateReleaseEvidence({
  ...rawEvidence,
  payment: {
    ...rawEvidence.payment,
    matrix: {
      ...rawEvidence.payment.matrix,
      receipt: { mode: "bulk", refreshReadBack: false },
      refund: { classification: "contract_only", outcome: "NOT_RUN", verified: false },
    },
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "closure" });
assert.equal(incompleteClosure.valid, false);
assert.ok(incompleteClosure.reasons.some((reason) => reason.includes("mode must be one_cut")));
assert.ok(incompleteClosure.reasons.some((reason) => reason.includes("refresh/read-back")));
assert.ok(incompleteClosure.reasons.some((reason) => reason.includes("provider_refunded")));

const missingManualClosure = validateReleaseEvidence({
  ...rawEvidence,
  payment: { ...rawEvidence.payment, providerReview: undefined },
  analyticsPrivacy: {
    ...rawEvidence.analyticsPrivacy,
    rawQueryAbsent: false,
    analyticsDeliveryVerified: false,
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "closure" });
assert.equal(missingManualClosure.valid, false);
assert.ok(missingManualClosure.reasons.some((reason) => reason.includes("manual provider")));
assert.ok(missingManualClosure.reasons.some((reason) => reason.includes("rawQueryAbsent")));
assert.ok(missingManualClosure.reasons.some((reason) => reason.includes("analyticsDeliveryVerified")));

const missingAccessBoundaryClosure = validateReleaseEvidence({
  ...rawEvidence,
  payment: {
    ...rawEvidence.payment,
    matrix: { ...rawEvidence.payment.matrix, accessBoundary: undefined },
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "closure" });
assert.equal(missingAccessBoundaryClosure.valid, false);
assert.ok(missingAccessBoundaryClosure.reasons.some((reason) => reason.includes("signedOutBillingReadDenied")));
assert.ok(missingAccessBoundaryClosure.reasons.some((reason) => reason.includes("access boundary matrix artifact")));

const arbitraryAccessBoundaryClosure = validateReleaseEvidence({
  ...rawEvidence,
  payment: {
    ...rawEvidence.payment,
    matrix: {
      ...rawEvidence.payment.matrix,
      accessBoundary: {
        ...rawEvidence.payment.matrix.accessBoundary,
        artifact: arbitraryAccessBoundaryArtifact,
      },
    },
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "closure" });
assert.equal(arbitraryAccessBoundaryClosure.valid, false);
assert.ok(arbitraryAccessBoundaryClosure.reasons.some((reason) => reason.includes("valid JSON preview runner output")));

const mismatchedAccessBoundaryClosure = validateReleaseEvidence({
  ...rawEvidence,
  payment: {
    ...rawEvidence.payment,
    matrix: {
      ...rawEvidence.payment.matrix,
      accessBoundary: {
        ...rawEvidence.payment.matrix.accessBoundary,
        runId: "different-run",
      },
    },
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "closure" });
assert.equal(mismatchedAccessBoundaryClosure.valid, false);
assert.ok(mismatchedAccessBoundaryClosure.reasons.some((reason) => reason.includes("closure runId")));

const prerequisiteEvidence = validateReleaseEvidence({
  ...rawEvidence,
  payment: { provider: "unifi", mode: "test" },
}, { target: PREVIEW_TARGET, root: evidenceRoot, stage: "prerequisite" });
assert.equal(prerequisiteEvidence.valid, true);
assert.equal(prerequisiteEvidence.payment.verified, false);
assert.deepEqual(validateClosureContinuity(prerequisiteEvidence, validEvidence).reasons, []);
assert.ok(validateClosureContinuity(
  prerequisiteEvidence,
  { ...validEvidence, runId: "another-run" },
).reasons.some((reason) => reason.includes("runId")));
assert.ok(validateClosureContinuity(
  prerequisiteEvidence,
  { ...validEvidence, supabase: { ...validEvidence.supabase, ref: "c".repeat(20) } },
).reasons.some((reason) => reason.includes("Supabase target")));

assert.deepEqual(parseCliArgs(["prerequisite", "--json"]), {
  help: false,
  json: true,
  stage: "prerequisite",
});
assert.deepEqual(parseCliArgs(["--", "closure", "--json"]), {
  help: false,
  json: true,
  stage: "closure",
});
assert.equal(parseCliArgs(["--help"]).help, true);
assert.throws(() => parseCliArgs([]), /exactly one stage/);
assert.deepEqual(missingEnvironment({}, "closure"), [
  "ACT001_PREFLIGHT_BASE_URL",
  "ACT001_PREFLIGHT_SUPABASE_URL",
  "ACT001_PREFLIGHT_SUPABASE_ANON_KEY",
  "ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT",
  "ACT001_PREFLIGHT_SUPABASE_SERVICE_ROLE_KEY",
  "ACT001_EVIDENCE_MANIFEST",
  "ACT001_CLOSURE_EVIDENCE",
]);

const futureEvidence = validateReleaseEvidence({
  ...rawEvidence,
  evidence: { ...rawEvidence.evidence, verifiedAt: new Date(Date.now() + 60_000).toISOString() },
}, { target: PREVIEW_TARGET, root: evidenceRoot });
assert.equal(futureEvidence.valid, false);
assert.ok(futureEvidence.reasons.some((reason) => reason.includes("timestamp")));

const urlEvidence = validateReleaseEvidence({
  ...rawEvidence,
  evidence: { ...rawEvidence.evidence, source: "https://example.test" },
}, { target: PREVIEW_TARGET, root: evidenceRoot });
assert.equal(urlEvidence.valid, false);
assert.ok(urlEvidence.reasons.some((reason) => reason.includes("source is not immutable")));

const outsideRoot = mkdtempSync(join(tmpdir(), "memecatch-loop-130-outside-"));
const outsideFile = join(outsideRoot, "outside.json");
const outsideContent = "outside evidence";
writeFileSync(outsideFile, outsideContent);
const linkedPath = join(evidenceRoot, "artifacts", "linked.json");
symlinkSync(outsideFile, linkedPath);
const symlinkEvidence = validateReleaseEvidence({
  ...rawEvidence,
  evidence: {
    source: join("artifacts", "linked.json"),
    sha256: createHash("sha256").update(outsideContent).digest("hex"),
    verifiedAt: EVIDENCE_TIMESTAMP,
  },
}, { target: PREVIEW_TARGET, root: evidenceRoot });
assert.equal(symlinkEvidence.valid, false);
assert.ok(symlinkEvidence.reasons.some((reason) => reason.includes("outside the evidence root")));

const routes = [
  { path: "/en/pricing", status: 200, ok: true, releaseSha: RELEASE_SHA },
  { path: "/en/explore", status: 200, ok: true, releaseSha: RELEASE_SHA },
  { path: "/premium", status: 307, ok: true, location: "/login?next=%2Fpremium", releaseSha: RELEASE_SHA },
];
const schemaCatalog = {
  state: "available",
  relations: [...CORE_RELATIONS],
  rpcs: [...AUTHENTICATED_RPCS],
};
const serviceSchemaCatalog = {
  state: "available",
  relations: [...CORE_RELATIONS],
  rpcs: [...SERVICE_ROLE_RPCS],
};
const relations = CORE_RELATIONS.map((relation) => ({
  relation,
  state: CORE_ACCESS_RELATIONS.includes(relation) ? "available" : "unknown",
  status: CORE_ACCESS_RELATIONS.includes(relation) ? 200 : 401,
}));

const ready = evaluateActivationPreflight({
  routes,
  schemaCatalog,
  serviceSchemaCatalog,
  relations,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: {
    reviewed: true,
    policyPresent: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
  },
});
assert.equal(ready.ready, true);
assert.deepEqual(ready.reasons, []);
assert.deepEqual(ready.supportingDegraded, [
  "billing_identities",
  "billing_unifi_payments",
  "plus_translation_requests",
  "plus_digest_preferences",
  "plus_saved_context_alerts",
]);
assert.ok(Object.values(ready.relationAccess).every((state) => state === "unknown" || state === "available"));

const authenticatedUnionFalsePass = evaluateActivationPreflight({
  routes,
  schemaCatalog: {
    ...schemaCatalog,
    rpcs: AUTHENTICATED_RPCS.filter((rpc) => rpc !== "create_billing_order"),
  },
  serviceSchemaCatalog: {
    ...serviceSchemaCatalog,
    rpcs: [...SERVICE_ROLE_RPCS, "create_billing_order"],
  },
  relations,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: { reviewed: true, policyPresent: true, providerDisclosure: true, outcomeDataDisclosure: true, retentionDisclosure: true },
});
assert.equal(authenticatedUnionFalsePass.ready, false);
assert.ok(authenticatedUnionFalsePass.reasons.some((reason) => reason.includes("authenticated RPC") && reason.includes("create_billing_order")));

const serviceUnionFalsePass = evaluateActivationPreflight({
  routes,
  schemaCatalog: {
    ...schemaCatalog,
    rpcs: [...AUTHENTICATED_RPCS, "reconcile_unifi_refund"],
  },
  serviceSchemaCatalog: {
    ...serviceSchemaCatalog,
    rpcs: SERVICE_ROLE_RPCS.filter((rpc) => rpc !== "reconcile_unifi_refund"),
  },
  relations,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: { reviewed: true, policyPresent: true, providerDisclosure: true, outcomeDataDisclosure: true, retentionDisclosure: true },
});
assert.equal(serviceUnionFalsePass.ready, false);
assert.ok(serviceUnionFalsePass.reasons.some((reason) => reason.includes("service-role RPC") && reason.includes("reconcile_unifi_refund")));

const missingSchema = evaluateActivationPreflight({
  routes,
  schemaCatalog: {
    state: "available",
    relations: CORE_RELATIONS.filter((relation) => relation !== "plus_meme_use_receipts"),
    rpcs: CORE_RPCS.filter((rpc) => rpc !== "record_plus_meme_use_rating"),
  },
  serviceSchemaCatalog,
  relations,
  migrations: { present: [], missing: ["20260809210000_plus_meme_use_receipts.sql"] },
  releaseEvidence: { ...validEvidence, valid: false, reasons: ["payment evidence is not verified"] },
  privacy: {
    reviewed: true,
    policyPresent: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
  },
});
assert.equal(missingSchema.ready, false);
assert.ok(missingSchema.reasons.some((reason) => reason.includes("plus_meme_use_receipts")));
assert.ok(missingSchema.reasons.some((reason) => reason.includes("record_plus_meme_use_rating")));
assert.ok(missingSchema.reasons.some((reason) => reason.includes("local migration source")));
assert.ok(missingSchema.reasons.some((reason) => reason.includes("payment evidence")));

const unavailableCatalog = evaluateActivationPreflight({
  routes,
  schemaCatalog: { state: "unknown", relations: [], rpcs: [] },
  serviceSchemaCatalog,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: {
    reviewed: true,
    policyPresent: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
  },
});
assert.equal(unavailableCatalog.ready, false);
assert.ok(unavailableCatalog.reasons.some((reason) => reason.includes("schema catalog")));

const mismatch = evaluateActivationPreflight({
  routes: routes.map((route, index) => ({ ...route, releaseSha: index === 1 ? "b".repeat(40) : RELEASE_SHA })),
  schemaCatalog,
  serviceSchemaCatalog,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: {
    reviewed: true,
    policyPresent: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
  },
});
assert.equal(mismatch.ready, false);
assert.ok(mismatch.reasons.some((reason) => reason.includes("SHA mismatch")));

const missingReleaseSha = evaluateActivationPreflight({
  routes: routes.map((route, index) => (index === 1 ? { ...route, releaseSha: undefined } : route)),
  schemaCatalog,
  serviceSchemaCatalog,
  relations,
  migrations: { present: [...REQUIRED_MIGRATIONS], missing: [] },
  releaseEvidence: validEvidence,
  privacy: {
    reviewed: true,
    policyPresent: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
  },
});
assert.equal(missingReleaseSha.ready, false);
assert.ok(missingReleaseSha.reasons.some((reason) => reason.includes("/en/explore")));

function runCli(env, args = ["prerequisite"]) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/plus-activation-preflight.mjs", ...args], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

let redirectMode = false;
let requestCount = 0;
const validPreviewJwts = new Set(["preview-jwt", "secret-preview-jwt", "secret-service-key"]);
const server = createServer((request, response) => {
  requestCount += 1;
  assert.equal(request.method, "GET");
  if (request.url === "/rest/v1/") {
    if (!validPreviewJwts.has(request.headers.authorization?.replace("Bearer ", ""))) {
      response.writeHead(401);
      response.end("invalid preview jwt");
      return;
    }
    const definitions = Object.fromEntries(CORE_RELATIONS.map((relation) => [relation, {}]));
    const roleRpcs = request.headers.authorization === "Bearer secret-service-key"
      ? SERVICE_ROLE_RPCS
      : AUTHENTICATED_RPCS;
    const paths = Object.fromEntries([
      ...CORE_RELATIONS.map((relation) => [`/${relation}`, {}]),
      ...roleRpcs.map((rpc) => [`/rpc/${rpc}`, {}]),
    ]);
    response.writeHead(200, { "content-type": "application/openapi+json" });
    response.end(JSON.stringify({ definitions, paths }));
    return;
  }
  const relationMatch = request.url.match(/^\/rest\/v1\/([^?]+)/u);
  if (relationMatch) {
    if (!validPreviewJwts.has(request.headers.authorization?.replace("Bearer ", ""))) {
      response.writeHead(401);
      response.end("invalid preview jwt");
      return;
    }
    if (CORE_ACCESS_RELATIONS.includes(relationMatch[1])) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("[]");
      return;
    }
    response.writeHead(401);
    response.end("authenticated role cannot read internal relation");
    return;
  }
  if (request.url === "/en/pricing" || request.url === "/en/explore") {
    if (redirectMode && request.url === "/en/explore") {
      response.writeHead(302, { location: "/elsewhere", "x-memecatch-release-sha": RELEASE_SHA });
      response.end();
      return;
    }
    response.writeHead(200, { "x-memecatch-release-sha": RELEASE_SHA });
    response.end("ok");
    return;
  }
  if (request.url === "/premium") {
    response.writeHead(307, {
      location: "/login?next=%2Fpremium",
      "x-memecatch-release-sha": RELEASE_SHA,
    });
    response.end();
    return;
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const addressUrl = `http://127.0.0.1:${address.port}`;
  mkdirSync(join(evidenceRoot, "app/(default)/privacy"), { recursive: true });
  writeFileSync(
    join(evidenceRoot, "app/(default)/privacy/page.tsx"),
    "Unifi payment receipt outcome retention 보관 기간 파기",
  );
  mkdirSync(join(evidenceRoot, "supabase/migrations"), { recursive: true });
  for (const migration of REQUIRED_MIGRATIONS) {
    writeFileSync(join(evidenceRoot, "supabase/migrations", migration), "-- verified test migration\n");
  }
  const runtimePrerequisite = {
    ...rawEvidence,
    target: addressUrl,
    supabase: { origin: addressUrl, ref: PREVIEW_SUPABASE_REF },
    payment: { provider: "unifi", mode: "test" },
  };
  const runtimeClosure = {
    ...rawEvidence,
    target: addressUrl,
    supabase: { origin: addressUrl, ref: PREVIEW_SUPABASE_REF },
  };
  writeFileSync(
    join(evidenceRoot, "manifest.json"),
    JSON.stringify({ prerequisite: runtimePrerequisite, closure: runtimeClosure }),
  );
  const runtimeEnv = { ACT001_EVIDENCE_MANIFEST: "manifest.json" };
  const requestsBeforeInvalidEvidence = requestCount;
  const localReport = await runPreflight({
    baseUrl: addressUrl,
    root: evidenceRoot,
    env: {},
  });
  assert.deepEqual(localReport.routes, []);
  assert.equal(localReport.readOnly, true);
  assert.equal(localReport.networkAccess, false);
  assert.equal(requestCount, requestsBeforeInvalidEvidence);
  assert.equal(localReport.gates.ready, false);
  assert.ok(localReport.gates.reasons.some((reason) => reason.includes("evidence manifest")));

  const requestsBeforeMismatch = requestCount;
  const targetMismatchReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: `http://localhost:${address.port}`,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    root: evidenceRoot,
    env: runtimeEnv,
  });
  assert.equal(targetMismatchReport.networkAccess, false);
  assert.equal(requestCount, requestsBeforeMismatch);
  assert.ok(targetMismatchReport.gates.reasons.some((reason) => reason.includes("Supabase origin does not match")));

  writeFileSync(join(evidenceRoot, "production-manifest.json"), JSON.stringify({
    prerequisite: { ...runtimePrerequisite, target: "https://catchmeme.com" },
  }));
  const requestsBeforeProductionTarget = requestCount;
  const productionTargetReport = await runPreflight({
    baseUrl: "https://catchmeme.com",
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    supabaseServiceRoleKey: "secret-service-key",
    root: evidenceRoot,
    env: { ACT001_EVIDENCE_MANIFEST: "production-manifest.json" },
    stage: "prerequisite",
  });
  assert.equal(productionTargetReport.networkAccess, false);
  assert.equal(requestCount, requestsBeforeProductionTarget);
  assert.ok(productionTargetReport.gates.reasons.some((reason) => reason.includes("production app origin")));

  const authenticatedReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    supabaseServiceRoleKey: "secret-service-key",
    root: evidenceRoot,
    env: runtimeEnv,
  });
  assert.equal(authenticatedReport.networkAccess, true);
  assert.equal(authenticatedReport.supabase.schemaCatalog.state, "available");
  assert.deepEqual(authenticatedReport.supabase.schemaCatalog.rpcs, [...AUTHENTICATED_RPCS].sort());
  assert.deepEqual(
    CORE_ACCESS_RELATIONS.map((relation) => authenticatedReport.gates.relationAccess[relation]),
    CORE_ACCESS_RELATIONS.map(() => "available"),
  );
  assert.equal(authenticatedReport.gates.ready, true);

  const invalidJwtReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "expired-jwt",
    supabaseServiceRoleKey: "secret-service-key",
    root: evidenceRoot,
    env: runtimeEnv,
  });
  assert.equal(invalidJwtReport.supabase.schemaCatalog.state, "unknown");
  assert.equal(invalidJwtReport.gates.ready, false);
  assert.ok(invalidJwtReport.gates.reasons.some((reason) => reason.includes("schema catalog")));

  redirectMode = true;
  const redirectedReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    supabaseServiceRoleKey: "secret-service-key",
    root: evidenceRoot,
    env: runtimeEnv,
  });
  assert.equal(redirectedReport.routes.find((route) => route.path === "/en/explore")?.status, 302);
  assert.equal(redirectedReport.routes.find((route) => route.path === "/en/explore")?.ok, false);
  redirectMode = false;

  const cli = await runCli({
    ...process.env,
    ACT001_PREFLIGHT_BASE_URL: addressUrl,
    ACT001_PREFLIGHT_SUPABASE_URL: addressUrl,
    ACT001_PREFLIGHT_SUPABASE_ANON_KEY: "secret-anon-key",
    ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT: "secret-preview-jwt",
    ACT001_PREFLIGHT_SUPABASE_SERVICE_ROLE_KEY: "secret-service-key",
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /ACT001_ENV_MISSING/u);
  assert.match(cli.stdout, /ACT001_EVIDENCE_MANIFEST/u);
  assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, /secret-anon-key/u);
  assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, /secret-preview-jwt/u);
  assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, /secret-service-key/u);
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const timeoutServer = createServer(() => {});
await new Promise((resolve, reject) => {
  timeoutServer.once("error", reject);
  timeoutServer.listen(0, "127.0.0.1", resolve);
});
try {
  const address = timeoutServer.address();
  assert.ok(address && typeof address === "object");
  const timeoutUrl = `http://127.0.0.1:${address.port}`;
  writeFileSync(join(evidenceRoot, "manifest.json"), JSON.stringify({
    prerequisite: {
      ...rawEvidence,
      target: timeoutUrl,
      supabase: { origin: timeoutUrl, ref: PREVIEW_SUPABASE_REF },
      payment: { provider: "unifi", mode: "test" },
    },
    closure: {
      ...rawEvidence,
      target: timeoutUrl,
      supabase: { origin: timeoutUrl, ref: PREVIEW_SUPABASE_REF },
    },
  }));
  process.env.ACT001_PREFLIGHT_TIMEOUT_MS = "100";
  const timedOutReport = await runPreflight({
    baseUrl: timeoutUrl,
    supabaseUrl: timeoutUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    supabaseServiceRoleKey: "secret-service-key",
    root: evidenceRoot,
    env: { ACT001_EVIDENCE_MANIFEST: "manifest.json" },
  });
  assert.equal(timedOutReport.networkAccess, true);
  assert.ok(timedOutReport.routes.every((route) => route.ok === false && route.error));
} finally {
  delete process.env.ACT001_PREFLIGHT_TIMEOUT_MS;
  await new Promise((resolve, reject) => timeoutServer.close((error) => (error ? reject(error) : resolve())));
}

rmSync(evidenceRoot, { recursive: true, force: true });
rmSync(outsideRoot, { recursive: true, force: true });

console.log("plus-activation-preflight contract tests passed");
