#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 10_000;
const RELEASE_SHA_HEADER = "x-memecatch-release-sha";
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ACT-001의 첫 paid-value 경로가 실제로 사용하는 테이블만 core로 판정한다.
// outcome_ratings는 테이블이 아니라 receipts의 column과 RPC를 추가하는 migration이다.
export const CORE_RELATIONS = [
  "billing_identities",
  "billing_subscriptions",
  "billing_webhook_events",
  "billing_unifi_payments",
  "plus_meme_use_completions",
  "plus_meme_use_receipts",
];

export const CORE_ACCESS_RELATIONS = [
  "billing_subscriptions",
  "plus_meme_use_completions",
  "plus_meme_use_receipts",
];

export const CORE_RPCS = [
  "has_active_plus",
  "create_unifi_payment_intent",
  "get_plus_meme_use_summary",
  "complete_plus_meme_use",
  "record_plus_meme_use_receipt",
  "get_plus_meme_use_outcome_summary",
  "record_plus_meme_use_performance",
  "record_plus_meme_use_rating",
];

export const SUPPORTING_RELATIONS = [
  "plus_translation_requests",
  "plus_digest_preferences",
  "plus_saved_context_alerts",
];

export const REQUIRED_MIGRATIONS = [
  "20260718120000_latpeed_billing.sql",
  "20260719160000_plus_saved_collections_notes.sql",
  "20260731130000_unifi_billing.sql",
  "20260804090000_unifi_renewal_carryover.sql",
  "20260809200000_plus_meme_use_completions.sql",
  "20260809210000_plus_meme_use_receipts.sql",
  "20260809220000_plus_meme_use_performance_followup.sql",
  "20260809230000_plus_meme_use_outcome_ratings.sql",
];

const REQUIRED_PAYMENT_STAGES = [
  "payment",
  "entitlement",
  "eligible_action",
  "receipt",
  "outcome",
];

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function normalizeBaseUrl(value, label = "base URL") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use http or https`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not contain credentials or query parameters`);
  }
  if (url.pathname !== "/") {
    throw new Error(`${label} must be an origin without a path`);
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new Error(`${label} must use https unless it targets loopback`);
  }
  return url.origin;
}

export function classifyRelationProbe({ status, body = "" }) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (status >= 200 && status < 300) return "available";
  if (status === 404 && /PGRST205|relation .* does not exist|not found/i.test(text)) {
    return "missing";
  }
  // 인증 실패는 스키마 존재의 증거가 아니다. 만료/잘못된 key도 같은 응답을 낸다.
  return "unknown";
}

function fetchSignal() {
  const configuredTimeout = Number.parseInt(process.env.ACT001_PREFLIGHT_TIMEOUT_MS ?? "", 10);
  const timeout = Number.isFinite(configuredTimeout)
    ? Math.min(30_000, Math.max(100, configuredTimeout))
    : REQUEST_TIMEOUT_MS;
  return AbortSignal.timeout(timeout);
}

function routeResult(path, response, error = null) {
  if (error) return { path, status: null, ok: false, error };
  const status = response.status;
  const location = response.headers.get("location");
  const releaseSha = response.headers.get(RELEASE_SHA_HEADER);
  const ok = path === "/premium"
    ? [301, 302, 303, 307, 308].includes(status) && /\/login\?next=/u.test(location ?? "")
    : status === 200;
  return {
    path,
    status,
    ok,
    ...(location ? { location } : {}),
    ...(releaseSha ? { releaseSha } : {}),
  };
}

async function probeRoute(baseUrl, path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: fetchSignal(),
    });
    return routeResult(path, response);
  } catch (error) {
    return routeResult(path, null, error instanceof Error ? error.message : "request failed");
  }
}

async function probeRelation(baseUrl, anonKey, previewJwt, relation) {
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/${relation}?select=*&limit=0`,
      {
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${previewJwt}`,
        },
        redirect: "manual",
        signal: fetchSignal(),
      },
    );
    const body = await response.text();
    return {
      relation,
      status: response.status,
      state: classifyRelationProbe({ status: response.status, body }),
    };
  } catch (error) {
    return {
      relation,
      status: null,
      state: "unknown",
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

function catalogNames(catalog) {
  const definitions = catalog?.definitions ?? catalog?.components?.schemas ?? {};
  const relationNames = new Set(Object.keys(definitions));
  const rpcNames = new Set();
  for (const path of Object.keys(catalog?.paths ?? {})) {
    const relationPath = path.match(/^\/(?:rest\/v1\/)?([^/]+)$/);
    if (relationPath && relationPath[1] !== "rpc") relationNames.add(relationPath[1]);
    const rpcPath = path.match(/^\/rpc\/([^/]+)$/);
    if (rpcPath) rpcNames.add(rpcPath[1]);
  }
  return {
    relations: [...relationNames].sort(),
    rpcs: [...rpcNames].sort(),
  };
}

async function probeSchemaCatalog(baseUrl, anonKey, previewJwt) {
  try {
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      headers: {
        accept: "application/openapi+json",
        apikey: anonKey,
        authorization: `Bearer ${previewJwt}`,
      },
      redirect: "manual",
      signal: fetchSignal(),
    });
    const body = await response.text();
    if (response.status < 200 || response.status >= 300) {
      return {
        state: "unknown",
        status: response.status,
        relations: [],
        rpcs: [],
        reason: response.status === 401 || response.status === 403
          ? "Supabase schema catalog authorization failed"
          : "Supabase schema catalog request failed",
      };
    }
    try {
      const summary = catalogNames(JSON.parse(body));
      return { state: "available", status: response.status, ...summary };
    } catch {
      return {
        state: "unknown",
        status: response.status,
        relations: [],
        rpcs: [],
        reason: "Supabase schema catalog was not valid JSON",
      };
    }
  } catch (error) {
    return {
      state: "unknown",
      status: null,
      relations: [],
      rpcs: [],
      reason: error instanceof Error ? error.message : "schema catalog request failed",
    };
  }
}

function migrationReport(root = process.cwd()) {
  const migrationDir = resolve(root, "supabase/migrations");
  const present = REQUIRED_MIGRATIONS.filter((file) => existsSync(resolve(migrationDir, file)));
  return {
    present,
    missing: REQUIRED_MIGRATIONS.filter((file) => !present.includes(file)),
  };
}

function privacyGate(root = process.cwd(), releaseEvidence = null) {
  const policyPath = resolve(root, "app/(default)/privacy/page.tsx");
  if (!existsSync(policyPath)) {
    return { reviewed: false, policyPresent: false, reason: "privacy policy file is missing" };
  }
  const policy = readFileSync(policyPath, "utf8");
  const provider = releaseEvidence?.payment?.provider;
  const providerDisclosure = provider === "unifi"
    ? /\bunifi\b/i.test(policy)
    : /\b(?:unifi|latpeed)\b/i.test(policy);
  const outcomeDataDisclosure = /receipt|성과|사용 결과|활용 결과|performance|outcome/i.test(policy);
  const retentionDisclosure = /보관 기간|파기|보존|retention/i.test(policy);
  const evidenceReviewed = releaseEvidence?.privacyReviewed === true;
  return {
    reviewed: evidenceReviewed && providerDisclosure && outcomeDataDisclosure && retentionDisclosure,
    policyPresent: true,
    providerDisclosure,
    outcomeDataDisclosure,
    retentionDisclosure,
    ...(evidenceReviewed && providerDisclosure && outcomeDataDisclosure && retentionDisclosure
      ? { source: "release evidence plus local privacy policy" }
      : { reason: "release evidence and local policy must confirm provider, outcome data, and retention disclosure" }),
  };
}

function isEvidenceReference(value) {
  return typeof value === "string"
    && value.trim() !== ""
    && !isAbsolute(value)
    && !/^[a-z][a-z0-9+.-]*:/iu.test(value.trim())
    && !value.includes("..")
    && !value.includes("\\")
    && !value.includes("\0");
}

function isTimestamp(value) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp)
    && typeof value === "string"
    && value.includes("T")
    && timestamp <= Date.now()
    && timestamp >= Date.now() - MAX_EVIDENCE_AGE_MS;
}

function validateEvidenceArtifact(value, label, { root, reasons }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reasons.push(`${label} artifact is missing`);
    return;
  }
  if (!isEvidenceReference(value.source)) reasons.push(`${label} artifact source is not immutable`);
  if (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/iu.test(value.sha256)) {
    reasons.push(`${label} artifact SHA256 is missing or invalid`);
  }
  if (!isTimestamp(value.verifiedAt)) reasons.push(`${label} artifact timestamp is missing or invalid`);
  if (!isEvidenceReference(value.source)) return;
  let rootPath;
  try {
    rootPath = realpathSync(resolve(root));
  } catch {
    reasons.push(`${label} evidence root is missing`);
    return;
  }
  const resolvedPath = resolve(rootPath, value.source);
  const relativePath = relative(rootPath, resolvedPath);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    reasons.push(`${label} artifact source must stay inside the evidence root`);
    return;
  }
  if (!existsSync(resolvedPath)) {
    reasons.push(`${label} artifact file is missing`);
    return;
  }
  const filePath = realpathSync(resolvedPath);
  const actualRelativePath = relative(rootPath, filePath);
  if (actualRelativePath === "" || actualRelativePath.startsWith("..") || isAbsolute(actualRelativePath)) {
    reasons.push(`${label} artifact resolves outside the evidence root`);
    return;
  }
  const actualHash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  if (typeof value.sha256 === "string" && actualHash !== value.sha256.toLowerCase()) {
    reasons.push(`${label} artifact SHA256 does not match its bytes`);
  }
}

export function validateReleaseEvidence(
  value,
  { target, requiredMigrations = REQUIRED_MIGRATIONS, root = process.cwd() } = {},
) {
  const reasons = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { configured: true, valid: false, reasons: ["release evidence must be a JSON object"] };
  }

  if (value.environment !== "preview") reasons.push("release evidence environment must be preview");
  if (value.workingTree !== "clean") reasons.push("release evidence must confirm a clean working tree");
  if (typeof value.commitSha !== "string" || !/^[0-9a-f]{40}$/i.test(value.commitSha)) {
    reasons.push("release evidence must contain a 40-character commit SHA");
  }
  validateEvidenceArtifact(value.evidence, "release", { root, reasons });

  try {
    if (normalizeBaseUrl(value.target, "release evidence target") !== target) {
      reasons.push("release evidence target does not match the preflight target");
    }
  } catch {
    reasons.push("release evidence target is invalid");
  }

  const payment = value.payment;
  if (payment?.provider !== "unifi") reasons.push("payment evidence must use Unifi");
  if (payment?.mode !== "test") reasons.push("payment evidence must be test mode");
  if (payment?.verified !== true) reasons.push("payment evidence is not verified");
  validateEvidenceArtifact(payment?.artifact, "payment", { root, reasons });
  const paymentStages = Array.isArray(payment?.e2e) ? payment.e2e : [];
  const missingPaymentStages = REQUIRED_PAYMENT_STAGES.filter((stage) => !paymentStages.includes(stage));
  if (missingPaymentStages.length > 0) {
    reasons.push(`payment E2E evidence missing: ${missingPaymentStages.join(", ")}`);
  }

  const privacy = value.privacy;
  if (privacy?.reviewed !== true) reasons.push("privacy review is not confirmed");
  validateEvidenceArtifact(privacy?.artifact, "privacy", { root, reasons });
  for (const field of ["providerDisclosure", "outcomeDataDisclosure", "retentionDisclosure"]) {
    if (privacy?.[field] !== true) reasons.push(`privacy evidence missing: ${field}`);
  }

  const migrations = value.migrations;
  const appliedMigrations = Array.isArray(migrations?.applied) ? migrations.applied : [];
  const missingMigrations = requiredMigrations.filter((file) => !appliedMigrations.includes(file));
  if (typeof migrations?.source !== "string" || migrations.source.trim() === "") {
    reasons.push("target migration ledger source is missing");
  }
  validateEvidenceArtifact(migrations?.artifact, "migration", { root, reasons });
  if (missingMigrations.length > 0) {
    reasons.push(`target migration ledger missing: ${missingMigrations.join(", ")}`);
  }

  return {
    configured: true,
    valid: reasons.length === 0,
    reasons,
    ...(typeof value.commitSha === "string" ? { commitSha: value.commitSha.toLowerCase() } : {}),
    target: typeof value.target === "string" ? value.target : null,
    environment: value.environment ?? null,
    privacyReviewed: privacy?.reviewed === true
      && privacy?.providerDisclosure === true
      && privacy?.outcomeDataDisclosure === true
      && privacy?.retentionDisclosure === true,
    migrationLedger: {
      source: typeof migrations?.source === "string" ? migrations.source : null,
      applied: appliedMigrations.filter((file) => typeof file === "string"),
      missing: missingMigrations,
      valid: missingMigrations.length === 0
        && typeof migrations?.source === "string"
        && migrations.source.trim() !== ""
        && !reasons.some((reason) => reason.startsWith("migration artifact")),
    },
    payment: {
      provider: payment?.provider ?? null,
      mode: payment?.mode ?? null,
      verified: payment?.verified === true,
      e2e: paymentStages.filter((stage) => typeof stage === "string"),
    },
  };
}

function loadReleaseEvidence(root, evidencePath, target) {
  if (!evidencePath) {
    return {
      configured: false,
      valid: false,
      reasons: ["ACT001_PREFLIGHT_EVIDENCE is required; no release state is inferred"],
    };
  }
  try {
    const filePath = resolve(root, evidencePath);
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    return validateReleaseEvidence(value, { target, root });
  } catch {
    return {
      configured: true,
      valid: false,
      reasons: ["release evidence file is missing or invalid JSON"],
    };
  }
}

export function evaluateActivationPreflight({
  routes,
  schemaCatalog,
  relations = [],
  migrations,
  releaseEvidence,
  privacy,
}) {
  const failedRoutes = routes.filter((route) => !route.ok).map((route) => route.path);
  const schemaAvailable = schemaCatalog?.state === "available";
  const catalogRelations = new Set(schemaCatalog?.relations ?? []);
  const catalogRpcs = new Set(schemaCatalog?.rpcs ?? []);
  const missingCoreRelations = schemaAvailable
    ? CORE_RELATIONS.filter((relation) => !catalogRelations.has(relation))
    : [];
  const missingCoreRpcs = schemaAvailable
    ? CORE_RPCS.filter((rpc) => !catalogRpcs.has(rpc))
    : [];
  const supportingDegraded = SUPPORTING_RELATIONS.filter(
    (relation) => !schemaAvailable || !catalogRelations.has(relation),
  );
  const relationByName = new Map(relations.map((relation) => [relation.relation, relation]));
  const coreAccessUnknown = CORE_ACCESS_RELATIONS.filter(
    (relation) => relationByName.get(relation)?.state !== "available",
  );
  const runtimeReleaseShas = [...new Set(
    routes
      .map((route) => route.releaseSha)
      .filter((sha) => typeof sha === "string")
      .map((sha) => sha.toLowerCase()),
  )];
  const expectedReleaseSha = releaseEvidence?.commitSha;
  const missingReleaseShaRoutes = routes
    .filter((route) => typeof route.releaseSha !== "string")
    .map((route) => route.path);
  const mismatchedReleaseShaRoutes = expectedReleaseSha
    ? routes
      .filter((route) => route.releaseSha?.toLowerCase() !== expectedReleaseSha)
      .map((route) => route.path)
    : [];
  const reasons = [
    ...failedRoutes.map((path) => `public route failed: ${path}`),
    ...(schemaAvailable ? [] : ["Supabase schema catalog is unavailable; valid read-only schema evidence is required"]),
    ...missingCoreRelations.map((relation) => `core relation missing from schema catalog: ${relation}`),
    ...missingCoreRpcs.map((rpc) => `core RPC missing from schema catalog: ${rpc}`),
    ...coreAccessUnknown.map((relation) => `authenticated preview read failed: ${relation}`),
    ...((migrations?.missing?.length ?? 0) > 0
      ? [`local migration source missing: ${migrations.missing.join(", ")}`]
      : []),
    ...(releaseEvidence?.valid ? [] : (releaseEvidence?.reasons ?? ["release evidence is not valid"])),
    ...(privacy?.policyPresent ? [] : ["privacy policy file is missing"]),
    ...(privacy?.providerDisclosure ? [] : ["privacy policy does not disclose the selected payment provider"]),
    ...(privacy?.outcomeDataDisclosure ? [] : ["privacy policy does not disclose outcome data"]),
    ...(privacy?.retentionDisclosure ? [] : ["privacy policy does not disclose retention"]),
    ...(privacy?.reviewed ? [] : ["privacy/provider disclosure has not passed the operator gate"]),
    ...(missingReleaseShaRoutes.length > 0
      ? [`deployed release SHA header missing: ${missingReleaseShaRoutes.join(", ")}`]
      : []),
    ...(mismatchedReleaseShaRoutes.length > 0
      ? [`deployed release SHA mismatch: ${mismatchedReleaseShaRoutes.join(", ")}`]
      : []),
    ...(runtimeReleaseShas.length !== 1
      ? ["all required routes must expose one identical deployed release SHA"]
      : []),
  ];

  return {
    ready: reasons.length === 0,
    reasons,
    coreSchema: {
      missing: missingCoreRelations,
      unknown: schemaAvailable ? [] : [...CORE_RELATIONS],
      accessUnknown: coreAccessUnknown,
      rpcMissing: missingCoreRpcs,
      catalog: schemaCatalog?.state ?? "unknown",
    },
    supportingDegraded,
    relationAccess: Object.fromEntries(
      [...CORE_RELATIONS, ...SUPPORTING_RELATIONS].map((relation) => [
        relation,
        relationByName.get(relation)?.state ?? "unknown",
      ]),
    ),
    runtimeReleaseShas,
  };
}

export async function runPreflight({
  baseUrl,
  supabaseUrl,
  supabaseAnonKey,
  supabaseJwt,
  root = process.cwd(),
  env = process.env,
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, "ACT001_PREFLIGHT_BASE_URL");
  const routes = await Promise.all([
    probeRoute(normalizedBaseUrl, "/en/pricing"),
    probeRoute(normalizedBaseUrl, "/en/explore"),
    probeRoute(normalizedBaseUrl, "/premium"),
  ]);
  const configuredSupabase = Boolean(supabaseUrl && supabaseAnonKey && supabaseJwt);
  const normalizedSupabaseUrl = configuredSupabase
    ? normalizeBaseUrl(supabaseUrl, "ACT001_PREFLIGHT_SUPABASE_URL")
    : null;
  const schemaCatalog = configuredSupabase
    ? await probeSchemaCatalog(normalizedSupabaseUrl, supabaseAnonKey, supabaseJwt)
    : {
        state: "unknown",
        status: null,
        relations: [],
        rpcs: [],
        reason: "Supabase URL, anon key, and scoped preview JWT are required",
      };
  const relations = configuredSupabase
    ? await Promise.all(
        [...CORE_RELATIONS, ...SUPPORTING_RELATIONS].map((relation) =>
          probeRelation(normalizedSupabaseUrl, supabaseAnonKey, supabaseJwt, relation),
        ),
      )
    : [...CORE_RELATIONS, ...SUPPORTING_RELATIONS].map((relation) => ({
        relation,
        status: null,
        state: "unknown",
        error: "Supabase URL, anon key, and scoped preview JWT are required",
      }));
  const migrations = migrationReport(root);
  const releaseEvidence = loadReleaseEvidence(
    root,
    env.ACT001_PREFLIGHT_EVIDENCE,
    normalizedBaseUrl,
  );
  const privacy = privacyGate(root, releaseEvidence);
  const gates = evaluateActivationPreflight({
    routes,
    schemaCatalog,
    relations,
    migrations,
    releaseEvidence,
    privacy,
  });
  return {
    target: normalizedBaseUrl,
    supabase: {
      configured: configuredSupabase,
      authenticatedPreview: Boolean(supabaseJwt),
      url: normalizedSupabaseUrl,
      schemaCatalog,
    },
    routes,
    relations,
    migrations,
    releaseEvidence,
    privacy,
    gates,
    readOnly: true,
  };
}

async function main() {
  const baseUrl = process.env.ACT001_PREFLIGHT_BASE_URL;
  if (!baseUrl) {
    throw new Error("ACT001_PREFLIGHT_BASE_URL is required; no target is inferred");
  }
  const report = await runPreflight({
    baseUrl,
    supabaseUrl: process.env.ACT001_PREFLIGHT_SUPABASE_URL,
    supabaseAnonKey: process.env.ACT001_PREFLIGHT_SUPABASE_ANON_KEY,
    supabaseJwt: process.env.ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT,
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`ACT-001-RC ${report.gates.ready ? "READY" : "BLOCKED"}`);
    for (const reason of report.gates.reasons) console.log(`- ${reason}`);
    if (report.gates.supportingDegraded.length > 0) {
      console.log(`supportingDegraded=${report.gates.supportingDegraded.join(",")}`);
    }
    console.log(`readOnly=${report.readOnly} target=${report.target}`);
  }
  if (!report.gates.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "ACT-001-RC preflight failed");
    process.exitCode = 1;
  });
}
