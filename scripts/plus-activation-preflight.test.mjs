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
  CORE_ACCESS_RELATIONS,
  CORE_RELATIONS,
  CORE_RPCS,
  REQUIRED_MIGRATIONS,
  classifyRelationProbe,
  evaluateActivationPreflight,
  normalizeBaseUrl,
  runPreflight,
  validateReleaseEvidence,
} from "./plus-activation-preflight.mjs";

const RELEASE_SHA = "a".repeat(40);
const PREVIEW_TARGET = "https://preview.example.test";
const EVIDENCE_TIMESTAMP = new Date().toISOString();
const evidenceRoot = mkdtempSync(join(tmpdir(), "memecatch-loop-130-"));
mkdirSync(join(evidenceRoot, "artifacts"), { recursive: true });
const artifact = (name) => {
  const source = join("artifacts", name);
  const filePath = join(evidenceRoot, source);
  const content = `${name}:${EVIDENCE_TIMESTAMP}`;
  writeFileSync(filePath, content);
  return {
    source,
    sha256: createHash("sha256").update(content).digest("hex"),
    verifiedAt: EVIDENCE_TIMESTAMP,
  };
};
const releaseArtifact = artifact("release.json");
const paymentArtifact = artifact("payment.json");
const privacyArtifact = artifact("privacy.json");
const migrationArtifact = artifact("migrations.json");

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

const rawEvidence = {
  environment: "preview",
  target: PREVIEW_TARGET,
  commitSha: RELEASE_SHA,
  workingTree: "clean",
  evidence: releaseArtifact,
  payment: {
    provider: "unifi",
    mode: "test",
    verified: true,
    e2e: ["payment", "entitlement", "eligible_action", "receipt", "outcome"],
    artifact: paymentArtifact,
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
};
const validEvidence = validateReleaseEvidence(rawEvidence, { target: PREVIEW_TARGET, root: evidenceRoot });
assert.equal(validEvidence.valid, true);
assert.equal(validEvidence.migrationLedger.valid, true);
assert.equal(validEvidence.privacyReviewed, true);

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
  rpcs: [...CORE_RPCS],
};
const relations = CORE_RELATIONS.map((relation) => ({
  relation,
  state: CORE_ACCESS_RELATIONS.includes(relation) ? "available" : "unknown",
  status: CORE_ACCESS_RELATIONS.includes(relation) ? 200 : 401,
}));

const ready = evaluateActivationPreflight({
  routes,
  schemaCatalog,
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
  "plus_translation_requests",
  "plus_digest_preferences",
  "plus_saved_context_alerts",
]);
assert.ok(Object.values(ready.relationAccess).every((state) => state === "unknown" || state === "available"));

const missingSchema = evaluateActivationPreflight({
  routes,
  schemaCatalog: {
    state: "available",
    relations: CORE_RELATIONS.filter((relation) => relation !== "plus_meme_use_receipts"),
    rpcs: CORE_RPCS.filter((rpc) => rpc !== "record_plus_meme_use_rating"),
  },
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

function runCli(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/plus-activation-preflight.mjs"], {
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
const validPreviewJwts = new Set(["preview-jwt", "secret-preview-jwt"]);
const server = createServer((request, response) => {
  assert.equal(request.method, "GET");
  if (request.url === "/rest/v1/") {
    if (!validPreviewJwts.has(request.headers.authorization?.replace("Bearer ", ""))) {
      response.writeHead(401);
      response.end("invalid preview jwt");
      return;
    }
    const definitions = Object.fromEntries(CORE_RELATIONS.map((relation) => [relation, {}]));
    const paths = Object.fromEntries([
      ...CORE_RELATIONS.map((relation) => [`/${relation}`, {}]),
      ...CORE_RPCS.map((rpc) => [`/rpc/${rpc}`, {}]),
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
  const localReport = await runPreflight({
    baseUrl: `http://127.0.0.1:${address.port}`,
    root: process.cwd(),
    env: {},
  });
  assert.deepEqual(localReport.routes.map((route) => route.ok), [true, true, true]);
  assert.equal(localReport.readOnly, true);
  assert.equal(localReport.gates.ready, false);
  assert.ok(localReport.gates.reasons.some((reason) => reason.includes("schema catalog")));
  assert.ok(localReport.gates.reasons.some((reason) => reason.includes("ACT001_PREFLIGHT_EVIDENCE")));

  const addressUrl = `http://127.0.0.1:${address.port}`;
  const authenticatedReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "preview-jwt",
    root: process.cwd(),
    env: {},
  });
  assert.equal(authenticatedReport.supabase.schemaCatalog.state, "available");
  assert.deepEqual(
    CORE_ACCESS_RELATIONS.map((relation) => authenticatedReport.gates.relationAccess[relation]),
    ["available", "available", "available"],
  );
  assert.equal(authenticatedReport.gates.ready, false);
  assert.ok(authenticatedReport.gates.reasons.some((reason) => reason.includes("ACT001_PREFLIGHT_EVIDENCE")));

  const invalidJwtReport = await runPreflight({
    baseUrl: addressUrl,
    supabaseUrl: addressUrl,
    supabaseAnonKey: "public-key",
    supabaseJwt: "expired-jwt",
    root: process.cwd(),
    env: {},
  });
  assert.equal(invalidJwtReport.supabase.schemaCatalog.state, "unknown");
  assert.equal(invalidJwtReport.gates.ready, false);
  assert.ok(invalidJwtReport.gates.reasons.some((reason) => reason.includes("schema catalog")));

  redirectMode = true;
  const redirectedReport = await runPreflight({
    baseUrl: addressUrl,
    root: process.cwd(),
    env: {},
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
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /supportingDegraded=/u);
  assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, /secret-anon-key/u);
  assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, /secret-preview-jwt/u);
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
  process.env.ACT001_PREFLIGHT_TIMEOUT_MS = "100";
  const timedOutReport = await runPreflight({
    baseUrl: `http://127.0.0.1:${address.port}`,
    root: process.cwd(),
    env: {},
  });
  assert.ok(timedOutReport.routes.every((route) => route.ok === false && route.error));
} finally {
  delete process.env.ACT001_PREFLIGHT_TIMEOUT_MS;
  await new Promise((resolve, reject) => timeoutServer.close((error) => (error ? reject(error) : resolve())));
}

rmSync(evidenceRoot, { recursive: true, force: true });
rmSync(outsideRoot, { recursive: true, force: true });

console.log("plus-activation-preflight contract tests passed");
