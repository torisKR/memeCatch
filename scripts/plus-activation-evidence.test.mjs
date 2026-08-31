import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_MIGRATIONS, validateReleaseEvidence } from "./plus-activation-preflight.mjs";
import { parseRemoteMigrations } from "./plus-activation-evidence.mjs";
import { validatePreviewBoundary } from "./plus-activation-preview.mjs";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "plus-activation-evidence.mjs");
const roots = [];
const git = (root, args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

function repo(branch = "act001-preview") {
  const root = mkdtempSync(join(tmpdir(), "memecatch-act001-evidence-"));
  roots.push(root);
  git(root, ["init", "-b", branch]);
  git(root, ["config", "user.email", "act001@example.test"]);
  git(root, ["config", "user.name", "ACT-001 Test"]);
  writeFileSync(join(root, ".gitignore"), ".local\nbin/\ninputs/\nsupabase/.temp/\n");
  writeFileSync(join(root, "README.md"), "fixture\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixture"]);
  mkdirSync(join(root, "inputs"));
  return root;
}

function inputs(root, overrides = {}) {
  const privacyPath = join(root, "inputs", "privacy.json");
  writeFileSync(privacyPath, JSON.stringify({
    reviewed: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
    redacted: true,
  }));
  const env = {
    ACT001_PREVIEW_APP_ORIGIN: "https://preview.example.test",
    ACT001_PREVIEW_SUPABASE_ORIGIN: "https://previewref1234567890.supabase.co",
    ACT001_PREVIEW_SUPABASE_REF: "previewref1234567890",
    ACT001_PRODUCTION_APP_ORIGIN: "https://catchmeme.com",
    ACT001_PRODUCTION_SUPABASE_ORIGIN: "https://onjipuldngbdptldkpoe.supabase.co",
    ACT001_PRODUCTION_SUPABASE_REF: "onjipuldngbdptldkpoe",
    ACT001_PRIVACY_REVIEW_JSON: privacyPath,
    ACT001_RUN_ID: "act001-test-run",
    ACT001_TEST_MIGRATION_OUTPUT: JSON.stringify(REQUIRED_MIGRATIONS.map((file) => ({
      local: file.slice(0, 14),
      remote: file.slice(0, 14),
    }))),
    ...overrides,
  };
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const fakeSupabase = join(bin, "supabase");
  writeFileSync(fakeSupabase, "#!/bin/sh\nif [ -n \"$ACT001_TEST_CLI_MARKER\" ]; then printf 'called\\n' > \"$ACT001_TEST_CLI_MARKER\"; fi\nprintf '%s' \"$ACT001_TEST_MIGRATION_OUTPUT\"\n");
  chmodSync(fakeSupabase, 0o755);
  mkdirSync(join(root, "supabase/.temp"), { recursive: true });
  writeFileSync(join(root, "supabase/.temp/project-ref"), `${env.ACT001_PREVIEW_SUPABASE_REF}\n`);
  return env;
}

function run(root, env, args = ["prepare", "--json"]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { PATH: `${join(root, "bin")}${delimiter}${process.env.PATH}`, ...env },
    encoding: "utf8",
  });
}

try {
  const happyRoot = repo();
  const happy = run(happyRoot, inputs(happyRoot));
  assert.equal(happy.status, 0, happy.stderr);
  const report = JSON.parse(happy.stdout);
  assert.equal(report.status, "READY");
  assert.equal(report.paymentVerified, false);
  assert.equal(report.networkScope, "linked-supabase-migration-ledger-read-only");
  const manifest = JSON.parse(readFileSync(report.manifestPath, "utf8"));
  const previewManifest = JSON.parse(readFileSync(report.previewManifestPath, "utf8"));
  const validation = validateReleaseEvidence(manifest.prerequisite, {
    target: "https://preview.example.test",
    root: happyRoot,
    stage: "prerequisite",
  });
  assert.equal(validation.valid, true, validation.reasons.join("; "));
  assert.deepEqual(manifest.prerequisite.supabase, {
    origin: "https://previewref1234567890.supabase.co",
    ref: "previewref1234567890",
  });
  assert.equal(manifest.prerequisite.migrations.source, "supabase:previewref1234567890:migration-list");
  assert.equal(JSON.parse(readFileSync(join(happyRoot, manifest.prerequisite.migrations.artifact.source))).projectRef, "previewref1234567890");
  const previewBoundaryEnv = {
    ACT001_PREVIEW_APP_ORIGIN: "https://preview.example.test",
    ACT001_PREVIEW_SUPABASE_ORIGIN: "https://previewref1234567890.supabase.co",
    ACT001_PRODUCTION_APP_ORIGIN: "https://catchmeme.com",
    ACT001_PRODUCTION_SUPABASE_ORIGIN: "https://onjipuldngbdptldkpoe.supabase.co",
  };
  assert.ok(validatePreviewBoundary(previewManifest, previewBoundaryEnv).some((item) => (
    item.code === "ACT001_FIXTURE_INVALID"
  )));
  assert.deepEqual(validatePreviewBoundary({
    ...previewManifest,
    memeId: "00000000-0000-4000-8000-000000000001",
    payment: {
      provider: "unifi",
      mode: "test",
      verified: true,
      browserArtifact: { source: "browser.md", sha256: "b".repeat(64) },
      confirmed: {
        requestId: "MC-real-confirmed-001",
        providerLinkId: "LINK-real-confirmed-001",
        transactionId: "unifi-real-confirmed-001",
        status: "CONFIRMED",
      },
      receipt: {
        id: "10000000-0000-4000-8000-000000000001",
        mode: "one_cut",
        refreshReadBack: true,
      },
    },
  }, previewBoundaryEnv), []);
  assert.equal(report.manifestSha256.length, 64);
  for (const reference of [
    manifest.prerequisite.evidence,
    manifest.prerequisite.migrations.artifact,
    manifest.prerequisite.privacy.artifact,
  ]) {
    const bytes = readFileSync(join(happyRoot, reference.source));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reference.sha256);
  }

  const dirtyRoot = repo();
  const dirtyEnv = inputs(dirtyRoot);
  writeFileSync(join(dirtyRoot, "README.md"), "dirty\n");
  assert.match(run(dirtyRoot, dirtyEnv).stderr, /clean git worktree/);

  const mainRoot = repo("main");
  assert.match(run(mainRoot, inputs(mainRoot)).stderr, /non-production branch/);

  const detachedRoot = repo();
  const detachedEnv = inputs(detachedRoot);
  git(detachedRoot, ["checkout", "--detach"]);
  assert.match(run(detachedRoot, detachedEnv).stderr, /non-production branch/);

  const equalRoot = repo();
  const equalEnv = inputs(equalRoot, {
    ACT001_PRODUCTION_APP_ORIGIN: "https://preview.example.test",
  });
  assert.match(run(equalRoot, equalEnv).stderr, /origins must be distinct/);
  const equalRefRoot = repo();
  const equalRefEnv = inputs(equalRefRoot, {
    ACT001_PRODUCTION_SUPABASE_REF: "previewref1234567890",
  });
  assert.match(run(equalRefRoot, equalRefEnv).stderr, /ref must be distinct/);

  const falseProductionRoot = repo();
  const falseProductionRef = "x".repeat(20);
  const falseProductionEnv = inputs(falseProductionRoot, {
    ACT001_PRODUCTION_SUPABASE_REF: falseProductionRef,
    ACT001_PRODUCTION_SUPABASE_ORIGIN: `https://${falseProductionRef}.supabase.co`,
  });
  assert.match(run(falseProductionRoot, falseProductionEnv).stderr, /canonical production project/);

  const falseProductionAppRoot = repo();
  const falseProductionAppEnv = inputs(falseProductionAppRoot, {
    ACT001_PREVIEW_APP_ORIGIN: "https://catchmeme.com",
    ACT001_PRODUCTION_APP_ORIGIN: "https://fake-production.example.test",
  });
  assert.match(run(falseProductionAppRoot, falseProductionAppEnv).stderr, /production app origin/);

  const wrongOriginRoot = repo();
  const wrongOriginEnv = inputs(wrongOriginRoot, {
    ACT001_PREVIEW_SUPABASE_ORIGIN: "https://preview-db.example.test",
  });
  assert.match(run(wrongOriginRoot, wrongOriginEnv).stderr, /must match its Supabase project ref/);

  const wrongLinkedRoot = repo();
  const wrongLinkedMarker = join(wrongLinkedRoot, "inputs/cli-called");
  const wrongLinkedEnv = inputs(wrongLinkedRoot, { ACT001_TEST_CLI_MARKER: wrongLinkedMarker });
  writeFileSync(join(wrongLinkedRoot, "supabase/.temp/project-ref"), "onjipuldngbdptldkpoe\n");
  assert.match(run(wrongLinkedRoot, wrongLinkedEnv).stderr, /linked Supabase project ref must match/);
  assert.equal(existsSync(wrongLinkedMarker), false);

  const symlinkRoot = repo();
  const symlinkEnv = inputs(symlinkRoot);
  const outsideDirectory = mkdtempSync(join(tmpdir(), "memecatch-act001-outside-"));
  roots.push(outsideDirectory);
  symlinkSync(outsideDirectory, join(symlinkRoot, ".local"), "dir");
  assert.match(run(symlinkRoot, symlinkEnv).stderr, /must stay inside the repository/);
  assert.equal(existsSync(join(outsideDirectory, "act-001")), false);

  const missingMigrationRoot = repo();
  const missingMigrationEnv = inputs(missingMigrationRoot, {
    ACT001_TEST_MIGRATION_OUTPUT: JSON.stringify(
      REQUIRED_MIGRATIONS.slice(1).map((file) => ({ remote: file.slice(0, 14) })),
    ),
  });
  assert.match(run(missingMigrationRoot, missingMigrationEnv).stderr, /remote migration ledger missing/);

  const sensitiveRoot = repo();
  const sensitiveEnv = inputs(sensitiveRoot);
  writeFileSync(sensitiveEnv.ACT001_PRIVACY_REVIEW_JSON, JSON.stringify({
    reviewed: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
    redacted: true,
    apiKey: "not-allowed",
  }));
  assert.match(run(sensitiveRoot, sensitiveEnv).stderr, /sensitive field/);
  writeFileSync(sensitiveEnv.ACT001_PRIVACY_REVIEW_JSON, JSON.stringify({
    reviewed: true,
    providerDisclosure: true,
    outcomeDataDisclosure: true,
    retentionDisclosure: true,
    redacted: true,
    note: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signaturevalue",
  }));
  assert.match(run(sensitiveRoot, sensitiveEnv).stderr, /secret-like value/);

  assert.deepEqual(parseRemoteMigrations(REQUIRED_MIGRATIONS.map((file) => ({
    local: null,
    remote: file.slice(0, 14),
  }))).applied, REQUIRED_MIGRATIONS);

  const help = run(happyRoot, {}, ["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /prepare/);
  console.log("ACT-001 evidence generator tests passed");
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
