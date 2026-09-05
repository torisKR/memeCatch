#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  PRODUCTION_APP_ORIGIN,
  PRODUCTION_SUPABASE_ORIGIN,
  PRODUCTION_SUPABASE_REF,
  REQUIRED_MIGRATIONS,
  normalizeBaseUrl,
  validateReleaseEvidence,
} from "./plus-activation-preflight.mjs";

const REQUIRED_ENV = [
  "ACT001_PREVIEW_APP_ORIGIN",
  "ACT001_PREVIEW_SUPABASE_ORIGIN",
  "ACT001_PREVIEW_SUPABASE_REF",
  "ACT001_PRODUCTION_APP_ORIGIN",
  "ACT001_PRODUCTION_SUPABASE_ORIGIN",
  "ACT001_PRODUCTION_SUPABASE_REF",
  "ACT001_PRIVACY_REVIEW_JSON",
];

const SENSITIVE_KEY = /(?:secret|password|authorization|credential|api.?key|service.?role|anon.?key|jwt|access.?token|refresh.?token|private.?key|signature)/iu;
const SENSITIVE_VALUE = /(?:\bBearer\s+\S+|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|\bsk-[A-Za-z0-9_-]{12,}|\bsk-or-v1-[A-Za-z0-9_-]{12,}|\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{12,})/iu;
const PRIVACY_FIELDS = [
  "reviewed",
  "providerDisclosure",
  "outcomeDataDisclosure",
  "retentionDisclosure",
  "redacted",
];

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function currentBranch(root) {
  try {
    return git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    return "";
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJson(path, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return bytes;
}

function artifact(source, bytes, verifiedAt) {
  return { source, sha256: sha256(bytes), verifiedAt };
}

function assertRedacted(value, path = "input") {
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value)) throw new Error(`${path} contains a secret-like value`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertRedacted(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error(`${path}.${key} is a sensitive field`);
    assertRedacted(child, `${path}.${key}`);
  }
}

function readJson(path, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch {
    throw new Error(`${label} must be a readable JSON file`);
  }
  assertRedacted(value, label);
  return value;
}

function migrationEntries(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.migrations)) return value.migrations;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.remote)) return value.remote.map((remote) => ({ remote }));
  throw new Error("migration list JSON must contain Supabase migration rows");
}

export function parseRemoteMigrations(value) {
  const versions = new Set();
  for (const entry of migrationEntries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const remote = entry.remote ?? entry.remote_version ?? entry.remoteVersion;
    if (typeof remote !== "string" && typeof remote !== "number") continue;
    const match = String(remote).match(/\b(\d{14})\b/u);
    if (match) versions.add(match[1]);
  }
  const applied = REQUIRED_MIGRATIONS.filter((file) => versions.has(file.slice(0, 14)));
  const missing = REQUIRED_MIGRATIONS.filter((file) => !applied.includes(file));
  if (missing.length > 0) throw new Error(`remote migration ledger missing: ${missing.join(", ")}`);
  return { applied, remoteVersions: [...versions].sort() };
}

function normalizeRef(value, label) {
  const ref = value?.trim();
  if (!/^[a-z0-9]{20}$/u.test(ref ?? "")) throw new Error(`${label} must be a 20-character Supabase project ref`);
  return ref;
}

function canonicalSupabaseOrigin(ref) {
  return `https://${ref}.supabase.co`;
}

function normalizePrivacy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("privacy review must be a JSON object");
  }
  for (const field of PRIVACY_FIELDS) {
    if (value[field] !== true) throw new Error(`privacy review must confirm ${field}=true`);
  }
  return Object.fromEntries(PRIVACY_FIELDS.map((field) => [field, true]));
}

function linkedSupabaseRef(root) {
  const path = resolve(root, "supabase/.temp/project-ref");
  try {
    return normalizeRef(readFileSync(path, "utf8"), "linked Supabase project ref");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("linked Supabase project ref")) throw error;
    throw new Error("ACT-001 evidence requires supabase/.temp/project-ref from a linked Preview project");
  }
}

function isInside(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
}

function evidenceBase(root) {
  const repositoryRoot = realpathSync(resolve(root));
  let parent = repositoryRoot;
  for (const segment of [".local", "act-001"]) {
    const next = resolve(parent, segment);
    if (!existsSync(next)) mkdirSync(next, { mode: 0o700 });
    const actual = realpathSync(next);
    if (!isInside(repositoryRoot, actual)) {
      throw new Error("ACT-001 evidence directory must stay inside the repository");
    }
    parent = actual;
  }
  return parent;
}

function repositoryRelativeSource(root, path) {
  const source = relative(realpathSync(resolve(root)), realpathSync(resolve(path)));
  if (!source || source.startsWith("..") || isAbsolute(source) || source.includes("\\")) {
    throw new Error("ACT-001 evidence directory must stay inside the repository");
  }
  return source;
}

function linkedMigrationLedger(root, projectRef) {
  let value;
  try {
    const output = execFileSync(
      "supabase",
      ["migration", "list", "--linked", "--output-format", "json"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    value = JSON.parse(output);
  } catch {
    throw new Error("linked Preview migration ledger could not be read with Supabase CLI");
  }
  assertRedacted(value, "migration list");
  return { ...parseRemoteMigrations(value), projectRef };
}

function defaultRunId(commitSha, now) {
  const timestamp = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z").toLowerCase();
  return `${commitSha.slice(0, 12)}-${timestamp}`;
}

function normalizeRunId(value, commitSha, now) {
  const runId = value?.trim() || defaultRunId(commitSha, now);
  if (!/^[a-z0-9][a-z0-9._-]{5,127}$/iu.test(runId)) throw new Error("ACT001_RUN_ID is invalid");
  assertRedacted(runId, "ACT001_RUN_ID");
  return runId;
}

export function prepareEvidence({ root = process.cwd(), env = process.env, now = new Date() } = {}) {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) throw new Error(`required environment variables missing: ${missing.join(", ")}`);

  const workingTree = git(root, ["status", "--porcelain"]);
  if (workingTree) throw new Error("ACT-001 evidence requires a clean git worktree");
  const branch = currentBranch(root);
  if (!branch || /^(?:main|master|prod|production)$/iu.test(branch)) {
    throw new Error("ACT-001 evidence requires a non-production branch and refuses detached HEAD");
  }
  assertRedacted(branch, "git branch");
  const commitSha = git(root, ["rev-parse", "HEAD"]).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) throw new Error("ACT-001 evidence requires a 40-character commit SHA");

  const previewAppOrigin = normalizeBaseUrl(env.ACT001_PREVIEW_APP_ORIGIN, "ACT001_PREVIEW_APP_ORIGIN");
  const previewSupabaseOrigin = normalizeBaseUrl(env.ACT001_PREVIEW_SUPABASE_ORIGIN, "ACT001_PREVIEW_SUPABASE_ORIGIN");
  const productionAppOrigin = normalizeBaseUrl(env.ACT001_PRODUCTION_APP_ORIGIN, "ACT001_PRODUCTION_APP_ORIGIN");
  const productionSupabaseOrigin = normalizeBaseUrl(env.ACT001_PRODUCTION_SUPABASE_ORIGIN, "ACT001_PRODUCTION_SUPABASE_ORIGIN");
  const previewSupabaseRef = normalizeRef(env.ACT001_PREVIEW_SUPABASE_REF, "ACT001_PREVIEW_SUPABASE_REF");
  const productionSupabaseRef = normalizeRef(env.ACT001_PRODUCTION_SUPABASE_REF, "ACT001_PRODUCTION_SUPABASE_REF");
  if (previewAppOrigin === productionAppOrigin || previewSupabaseOrigin === productionSupabaseOrigin) {
    throw new Error("preview origins must be distinct from production origins");
  }
  if (previewSupabaseRef === productionSupabaseRef) {
    throw new Error("preview Supabase ref must be distinct from production Supabase ref");
  }
  if (previewAppOrigin === PRODUCTION_APP_ORIGIN) {
    throw new Error("ACT001_PREVIEW_APP_ORIGIN must not be the production app origin");
  }
  if (productionAppOrigin !== PRODUCTION_APP_ORIGIN) {
    throw new Error("ACT001_PRODUCTION_APP_ORIGIN must match the canonical production app origin");
  }
  if (productionSupabaseRef !== PRODUCTION_SUPABASE_REF) {
    throw new Error("ACT001_PRODUCTION_SUPABASE_REF must match the canonical production project");
  }
  if (previewSupabaseOrigin !== canonicalSupabaseOrigin(previewSupabaseRef)) {
    throw new Error("ACT001_PREVIEW_SUPABASE_ORIGIN must match its Supabase project ref");
  }
  if (productionSupabaseOrigin !== PRODUCTION_SUPABASE_ORIGIN) {
    throw new Error("ACT001_PRODUCTION_SUPABASE_ORIGIN must match the canonical production project");
  }
  const linkedRef = linkedSupabaseRef(root);
  if (linkedRef !== previewSupabaseRef) {
    throw new Error("linked Supabase project ref must match ACT001_PREVIEW_SUPABASE_REF");
  }

  const migrations = linkedMigrationLedger(root, linkedRef);
  const privacy = normalizePrivacy(readJson(env.ACT001_PRIVACY_REVIEW_JSON, "privacy review"));
  const verifiedAt = now.toISOString();
  const runId = normalizeRunId(env.ACT001_RUN_ID, commitSha, now);
  if (runId.includes("..")) throw new Error("ACT001_RUN_ID is invalid");
  const outputRoot = resolve(evidenceBase(root), runId);
  if (existsSync(outputRoot)) throw new Error(`evidence directory already exists: ${outputRoot}`);
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 });

  const releasePath = resolve(outputRoot, "release.json");
  const migrationPath = resolve(outputRoot, "migrations.json");
  const privacyPath = resolve(outputRoot, "privacy.json");

  const releaseBytes = writeJson(releasePath, {
    runId,
    environment: "preview",
    commitSha,
    branch,
    workingTree: "clean",
    appOrigin: previewAppOrigin,
    supabaseOrigin: previewSupabaseOrigin,
    supabaseRef: previewSupabaseRef,
    provider: "unifi",
    mode: "test",
    verified: false,
    generatedAt: verifiedAt,
    redacted: true,
  });
  const migrationBytes = writeJson(migrationPath, {
    projectRef: migrations.projectRef,
    applied: migrations.applied,
    remoteVersions: migrations.remoteVersions,
    generatedAt: verifiedAt,
    redacted: true,
  });
  const privacyBytes = writeJson(privacyPath, {
    ...privacy,
    generatedAt: verifiedAt,
  });
  const previewManifestPath = resolve(outputRoot, "preview-manifest.json");
  writeJson(previewManifestPath, {
    environment: "preview",
    appUrl: previewAppOrigin,
    supabaseUrl: previewSupabaseOrigin,
    supabaseRef: previewSupabaseRef,
    runId,
    commitSha,
    memeId: null,
    locale: "en",
    migrationLedger: {
      source: `supabase:${previewSupabaseRef}:migration-list`,
      applied: migrations.applied,
    },
    payment: { provider: "unifi", mode: "test", verified: false },
    redacted: true,
  });

  const prerequisite = {
    runId,
    environment: "preview",
    target: previewAppOrigin,
    commitSha,
    workingTree: "clean",
    supabase: { origin: previewSupabaseOrigin, ref: previewSupabaseRef },
    evidence: artifact(repositoryRelativeSource(root, releasePath), releaseBytes, verifiedAt),
    payment: { provider: "unifi", mode: "test", verified: false, e2e: [] },
    privacy: {
      reviewed: true,
      providerDisclosure: true,
      outcomeDataDisclosure: true,
      retentionDisclosure: true,
      artifact: artifact(repositoryRelativeSource(root, privacyPath), privacyBytes, verifiedAt),
    },
    migrations: {
      source: `supabase:${previewSupabaseRef}:migration-list`,
      applied: migrations.applied,
      artifact: artifact(repositoryRelativeSource(root, migrationPath), migrationBytes, verifiedAt),
    },
  };
  const validation = validateReleaseEvidence(prerequisite, {
    target: previewAppOrigin,
    root,
    stage: "prerequisite",
  });
  if (!validation.valid) throw new Error(`generated prerequisite is invalid: ${validation.reasons.join("; ")}`);

  const manifestPath = resolve(outputRoot, "manifest.json");
  const manifestBytes = writeJson(manifestPath, {
    schemaVersion: 1,
    prerequisite,
    generatedAt: verifiedAt,
    redacted: true,
  });
  return {
    status: "READY",
    stage: "prepare",
    runId,
    commitSha,
    branch,
    manifestPath,
    previewManifestPath,
    manifestSha256: sha256(manifestBytes),
    paymentVerified: false,
    networkAccess: true,
    networkScope: "linked-supabase-migration-ledger-read-only",
  };
}

const HELP = `Usage: node scripts/plus-activation-evidence.mjs prepare [--json]\n\n` +
  `prepare  Generate a redacted ACT-001 prerequisite manifest under .local/act-001/<runId>/.\n` +
  `--json   Print a machine-readable result.\n` +
  `--help   Show this help.\n\n` +
  `Inputs are provided with ACT001_PREVIEW_APP_ORIGIN, ACT001_PREVIEW_SUPABASE_ORIGIN,\n` +
  `ACT001_PREVIEW_SUPABASE_REF, ACT001_PRODUCTION_APP_ORIGIN,\n` +
  `ACT001_PRODUCTION_SUPABASE_ORIGIN, ACT001_PRODUCTION_SUPABASE_REF,\n` +
  `and ACT001_PRIVACY_REVIEW_JSON. The linked migration ledger is read with Supabase CLI.`;

export function parseCliArgs(args) {
  const values = args.filter((arg) => arg !== "--");
  if (values.includes("--help") || values.includes("-h")) return { help: true, json: values.includes("--json") };
  const unknown = values.filter((arg) => arg !== "prepare" && arg !== "--json");
  if (unknown.length > 0) throw new Error(`unknown argument: ${unknown.join(", ")}`);
  if (values.filter((arg) => arg === "prepare").length !== 1) throw new Error("exactly one command is required: prepare");
  return { help: false, json: values.includes("--json") };
}

function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      console.log(HELP);
      return;
    }
    const report = prepareEvidence();
    console.log(options.json ? JSON.stringify(report, null, 2) : `ACT-001 prepare READY\nmanifest=${report.manifestPath}\nrunId=${report.runId}\npaymentVerified=false`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "ACT-001 evidence preparation failed");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
