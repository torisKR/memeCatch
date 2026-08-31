#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 10_000;
const RELEASE_SHA_HEADER = "x-memecatch-release-sha";
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ACT-001의 첫 paid-value 경로가 실제로 사용하는 테이블만 core로 판정한다.
// outcome_ratings는 테이블이 아니라 receipts의 column과 RPC를 추가하는 migration이다.
export const CORE_RELATIONS = [
  "billing_orders",
  "billing_subscriptions",
  "billing_webhook_events",
  "plus_meme_use_completions",
  "plus_meme_use_receipts",
];

export const CORE_ACCESS_RELATIONS = [
  "billing_orders",
  "billing_subscriptions",
  "plus_meme_use_completions",
  "plus_meme_use_receipts",
];

export const AUTHENTICATED_RPCS = [
  "create_billing_order",
  "attach_unifi_payment_link",
  "has_active_plus",
  "get_plus_meme_use_summary",
  "complete_plus_meme_use",
  "record_plus_meme_use_receipt",
  "get_plus_meme_use_outcome_summary",
  "record_plus_meme_use_performance",
  "record_plus_meme_use_rating",
];

export const SERVICE_ROLE_RPCS = [
  "process_unifi_order_event",
  "reconcile_unifi_refund",
];

export const CORE_RPCS = [...AUTHENTICATED_RPCS, ...SERVICE_ROLE_RPCS];

export const SUPPORTING_RELATIONS = [
  "billing_identities",
  "billing_unifi_payments",
  "plus_translation_requests",
  "plus_digest_preferences",
  "plus_saved_context_alerts",
];

export const REQUIRED_MIGRATIONS = [
  "20260809200000_plus_meme_use_completions.sql",
  "20260809210000_plus_meme_use_receipts.sql",
  "20260809220000_plus_meme_use_performance_followup.sql",
  "20260809230000_plus_meme_use_outcome_ratings.sql",
  "20260810100000_plus_meme_use_receipt_integrity.sql",
  "20260817120000_growth_plan_p0.sql",
  "20260818123000_growth_p0_contract_fixes.sql",
  "20260831100000_plus_one_cut_trust_foundation.sql",
  "20260831101000_plus_one_cut_trust_enforcement.sql",
];

export const ACTIVATION_STAGES = ["prerequisite", "closure"];

export function makeBlocker(code, stage, message, nextAction, retryable = true) {
  return { code, stage, message, nextAction, retryable };
}

function blockersFromReasons(reasons, stage) {
  const codeForReason = (message) => {
    if (message.startsWith("public route failed")) return "ACT001_ROUTE_UNAVAILABLE";
    if (message.includes("schema catalog")) return "ACT001_SCHEMA_CATALOG_UNAVAILABLE";
    if (message.startsWith("core relation")) return "ACT001_CORE_RELATION_MISSING";
    if (message.includes("RPC missing")) return "ACT001_CORE_RPC_MISSING";
    if (message.startsWith("authenticated preview read")) return "ACT001_PREVIEW_ACCESS_FAILED";
    if (message.startsWith("local migration source")) return "ACT001_LOCAL_MIGRATION_MISSING";
    if (message.includes("migration ledger")) return "ACT001_MIGRATION_LEDGER_MISMATCH";
    if (message.includes("runId")) return "ACT001_RUN_ID_MISMATCH";
    if (message.includes("release SHA") || message.includes("commit SHA")) return "ACT001_RELEASE_SHA_MISMATCH";
    if (message.startsWith("privacy")) return "ACT001_PRIVACY_GATE_BLOCKED";
    if (message.includes("payment")) return "ACT001_PAYMENT_EVIDENCE_INVALID";
    return "ACT001_EVIDENCE_INVALID";
  };
  return reasons.map((message) => makeBlocker(
    codeForReason(message),
    stage,
    message,
    stage === "prerequisite"
      ? "Resolve every prerequisite and rerun the prerequisite stage."
      : "Regenerate redacted closure evidence for the same run and rerun closure.",
  ));
}

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
  const current = existsSync(migrationDir)
    ? readdirSync(migrationDir).filter((file) => /^\d{14}_.+\.sql$/u.test(file)).sort()
    : [];
  return {
    current,
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
  const providerDisclosure = /\bunifi\b/i.test(policy);
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

function findSensitiveEvidenceField(value, path = "evidence") {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/(?:secret|password|authorization|service.?role|anon.?key|jwt|access.?token|refresh.?token)/iu.test(key)) {
      return childPath;
    }
    const nested = findSensitiveEvidenceField(child, childPath);
    if (nested) return nested;
  }
  return null;
}

function normalizedLedger(value) {
  const applied = Array.isArray(value?.applied)
    ? [...new Set(value.applied.filter((entry) => typeof entry === "string"))].sort()
    : [];
  return {
    source: typeof value?.source === "string" ? value.source : null,
    applied,
    artifactSha256: typeof value?.artifact?.sha256 === "string"
      ? value.artifact.sha256.toLowerCase()
      : null,
  };
}

function ledgerFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(normalizedLedger(value))).digest("hex");
}

function validateClosureMatrix(matrix, { root, reasons, runId, commitSha }) {
  validateEvidenceArtifact(matrix?.artifact, "payment matrix", { root, reasons });
  for (const field of [
    "confirmedRealPayment",
    "entitlementExactlyOnce",
    "eligibleTrustedAction",
    "duplicateWebhook",
    "mismatchDenied",
    "freeDenied",
    "expiredDenied",
    "crossOwnerDenied",
    "receiptConflictDenied",
  ]) {
    if (matrix?.[field] !== true) reasons.push(`payment closure matrix missing: ${field}`);
  }
  if (matrix?.entitlementCount !== 1) {
    reasons.push("payment closure entitlement count must equal one");
  }
  if (matrix?.duplicateWebhookEventCount !== 1) {
    reasons.push("payment closure duplicate webhook event count must equal one");
  }
  const validProviderId = (value) => typeof value === "string"
    && value.trim().length >= 6
    && !/(?:^|[-_])(act001|fake|synthetic|mock)(?:[-_]|$)/iu.test(value.trim());
  if (
    matrix?.confirmed?.provider !== "unifi"
    || matrix?.confirmed?.mode !== "test"
    || matrix?.confirmed?.status !== "CONFIRMED"
    || !validProviderId(matrix?.confirmed?.providerLinkId)
    || !validProviderId(matrix?.confirmed?.transactionId)
  ) {
    reasons.push("payment closure confirmed transaction is missing real Unifi test identity");
  }
  if (matrix?.receipt?.mode !== "one_cut") {
    reasons.push("payment closure receipt mode must be one_cut");
  }
  if (matrix?.receipt?.refreshReadBack !== true) {
    reasons.push("payment closure receipt refresh/read-back is not verified");
  }
  if (
    matrix?.refund?.classification !== "provider_refunded"
    || matrix?.refund?.outcome !== "REFUNDED"
    || matrix?.refund?.verified !== true
    || matrix?.refund?.originalTransactionId !== matrix?.confirmed?.transactionId
    || !validProviderId(matrix?.refund?.refundTransactionId)
  ) {
    reasons.push("payment closure refund must be verified provider_refunded evidence");
  }
  const accessBoundary = matrix?.accessBoundary;
  const accessArtifactBytes = validateEvidenceArtifact(
    accessBoundary?.artifact,
    "access boundary matrix",
    { root, reasons },
  );
  for (const field of [
    "signedOutBillingReadDenied",
    "signedOutReceiptReadDenied",
    "crossOwnerBillingOrderReadDenied",
    "authenticatedRefundRpcDenied",
  ]) {
    if (accessBoundary?.[field] !== true) reasons.push(`payment closure access boundary missing: ${field}`);
  }
  if (matrix?.runId !== runId || accessBoundary?.runId !== runId) {
    reasons.push("payment closure access boundary runId does not match closure runId");
  }
  if (
    matrix?.commitSha?.toLowerCase() !== commitSha?.toLowerCase()
    || accessBoundary?.commitSha?.toLowerCase() !== commitSha?.toLowerCase()
  ) {
    reasons.push("payment closure access boundary commit SHA does not match closure commit SHA");
  }
  validateAccessBoundaryRunnerOutput(accessArtifactBytes, {
    accessBoundary,
    runId,
    commitSha,
    reasons,
  });
}

function validateAccessBoundaryRunnerOutput(bytes, { accessBoundary, runId, commitSha, reasons }) {
  if (!bytes) return;
  let report;
  try {
    report = JSON.parse(bytes.toString("utf8"));
  } catch {
    reasons.push("access boundary matrix artifact must be valid JSON preview runner output");
    return;
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    reasons.push("access boundary matrix artifact must be a JSON object");
    return;
  }
  if (
    report.status !== "READ_MATRIX_PASS"
    || report.stage !== "preview"
    || report.provider !== "unifi"
    || report.environment !== "preview"
    || report.redacted !== true
  ) {
    reasons.push("access boundary matrix artifact is not a redacted READ_MATRIX_PASS preview result");
  }
  if (report.runId !== runId || report.accessBoundary?.runId !== runId) {
    reasons.push("access boundary matrix artifact runId does not match closure runId");
  }
  if (
    report.commitSha?.toLowerCase() !== commitSha?.toLowerCase()
    || report.accessBoundary?.commitSha?.toLowerCase() !== commitSha?.toLowerCase()
  ) {
    reasons.push("access boundary matrix artifact commit SHA does not match closure commit SHA");
  }
  for (const field of [
    "signedOutBillingReadDenied",
    "signedOutReceiptReadDenied",
    "crossOwnerBillingOrderReadDenied",
    "authenticatedRefundRpcDenied",
  ]) {
    if (report.accessBoundary?.[field] !== true || report.accessBoundary?.[field] !== accessBoundary?.[field]) {
      reasons.push(`access boundary matrix artifact missing verified flag: ${field}`);
    }
  }
  const matrixEntries = new Set(Array.isArray(report.matrix) ? report.matrix : []);
  for (const entry of [
    "signed-out-billing-read-denied",
    "signed-out-receipt-read-denied",
    "cross-owner-billing-order-read-denied",
    "authenticated-refund-rpc-denied",
  ]) {
    if (!matrixEntries.has(entry)) reasons.push(`access boundary matrix artifact missing entry: ${entry}`);
  }
  if (
    report.claims?.providerE2e !== false
    || report.claims?.browserRefresh !== false
    || report.claims?.analyticsDelivery !== false
  ) {
    reasons.push("access boundary matrix artifact must preserve READ_MATRIX_PASS limitation claims");
  }
  const sensitiveField = findSensitiveEvidenceField(report, "access boundary runner output");
  if (sensitiveField) reasons.push(`access boundary matrix artifact must be redacted: ${sensitiveField}`);
}

function validateAnalyticsPrivacyEvidence(value, { root, reasons }) {
  validateEvidenceArtifact(value?.artifact, "analytics/privacy matrix", { root, reasons });
  if (value?.rawQueryAbsent !== true) {
    reasons.push("analytics/privacy matrix must confirm rawQueryAbsent=true");
  }
  if (value?.analyticsDeliveryVerified !== true) {
    reasons.push("analytics/privacy matrix must confirm analyticsDeliveryVerified=true");
  }
}

function validateProviderReview(review, paymentArtifact, { root, reasons }) {
  validateEvidenceArtifact(review?.artifact, "manual provider review", { root, reasons });
  if (review?.reviewed !== true) reasons.push("manual provider evidence review is not confirmed");
  if (review?.reviewerRole !== "operator") reasons.push("manual provider reviewerRole must be operator");
  if (!isTimestamp(review?.verifiedAt)) reasons.push("manual provider review timestamp is missing or invalid");
  if (
    !/(?:^|\/)browser\.md$/u.test(review?.artifact?.source ?? "")
    || review?.artifact?.source !== paymentArtifact?.source
    || review?.artifact?.sha256?.toLowerCase() !== paymentArtifact?.sha256?.toLowerCase()
  ) {
    reasons.push("manual provider review must be tied to the same browser.md payment artifact");
  }
}

function validateEvidenceArtifact(value, label, { root, reasons }) {
  const initialReasonCount = reasons.length;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reasons.push(`${label} artifact is missing`);
    return null;
  }
  if (!isEvidenceReference(value.source)) reasons.push(`${label} artifact source is not immutable`);
  if (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/iu.test(value.sha256)) {
    reasons.push(`${label} artifact SHA256 is missing or invalid`);
  }
  if (!isTimestamp(value.verifiedAt)) reasons.push(`${label} artifact timestamp is missing or invalid`);
  if (!isEvidenceReference(value.source)) return null;
  let rootPath;
  try {
    rootPath = realpathSync(resolve(root));
  } catch {
    reasons.push(`${label} evidence root is missing`);
    return null;
  }
  const resolvedPath = resolve(rootPath, value.source);
  const relativePath = relative(rootPath, resolvedPath);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    reasons.push(`${label} artifact source must stay inside the evidence root`);
    return null;
  }
  if (!existsSync(resolvedPath)) {
    reasons.push(`${label} artifact file is missing`);
    return null;
  }
  const filePath = realpathSync(resolvedPath);
  const actualRelativePath = relative(rootPath, filePath);
  if (actualRelativePath === "" || actualRelativePath.startsWith("..") || isAbsolute(actualRelativePath)) {
    reasons.push(`${label} artifact resolves outside the evidence root`);
    return null;
  }
  const bytes = readFileSync(filePath);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (typeof value.sha256 === "string" && actualHash !== value.sha256.toLowerCase()) {
    reasons.push(`${label} artifact SHA256 does not match its bytes`);
  }
  return reasons.length === initialReasonCount ? bytes : null;
}

export function validateReleaseEvidence(
  value,
  {
    target,
    requiredMigrations = REQUIRED_MIGRATIONS,
    root = process.cwd(),
    stage = "closure",
  } = {},
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
  const sensitiveField = findSensitiveEvidenceField(value);
  if (sensitiveField) reasons.push(`release evidence must be redacted: ${sensitiveField}`);
  if (typeof value.runId !== "string" || !/^[a-z0-9][a-z0-9._-]{5,127}$/iu.test(value.runId)) {
    reasons.push("release evidence runId is missing or invalid");
  }

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
  const paymentStages = Array.isArray(payment?.e2e) ? payment.e2e : [];
  if (stage === "closure") {
    if (payment?.verified !== true) reasons.push("payment evidence is not verified");
    validateEvidenceArtifact(payment?.artifact, "payment", { root, reasons });
    const missingPaymentStages = REQUIRED_PAYMENT_STAGES.filter((paymentStage) => !paymentStages.includes(paymentStage));
    if (missingPaymentStages.length > 0) {
      reasons.push(`payment E2E evidence missing: ${missingPaymentStages.join(", ")}`);
    }
    validateClosureMatrix(payment?.matrix, {
      root,
      reasons,
      runId: value.runId,
      commitSha: value.commitSha,
    });
    validateProviderReview(payment?.providerReview, payment?.artifact, { root, reasons });
    validateAnalyticsPrivacyEvidence(value.analyticsPrivacy, { root, reasons });
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
    runId: typeof value.runId === "string" ? value.runId : null,
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
      fingerprint: ledgerFingerprint(migrations),
    },
    payment: {
      provider: payment?.provider ?? null,
      mode: payment?.mode ?? null,
      verified: payment?.verified === true,
      e2e: paymentStages.filter((stage) => typeof stage === "string"),
    },
  };
}

function loadEvidenceDocument(root, evidencePath) {
  if (!evidencePath) {
    return {
      configured: false,
      valid: false,
      reasons: ["evidence manifest is required; no release state is inferred"],
    };
  }
  try {
    const filePath = resolve(root, evidencePath);
    return { configured: true, valid: true, value: JSON.parse(readFileSync(filePath, "utf8")) };
  } catch {
    return {
      configured: true,
      valid: false,
      reasons: ["evidence manifest is missing or invalid JSON"],
    };
  }
}

function loadReleaseEvidence(root, evidencePath, target, stage, requiredMigrations) {
  const document = loadEvidenceDocument(root, evidencePath);
  if (!document.valid) return document;
  const value = document.value?.[stage] ?? document.value;
  return validateReleaseEvidence(value, { target, root, stage, requiredMigrations });
}

export function validateClosureContinuity(prerequisite, closure) {
  const reasons = [];
  if (!prerequisite?.valid) reasons.push("prerequisite evidence is invalid");
  if (!closure?.valid) reasons.push("closure evidence is invalid");
  if (prerequisite?.commitSha !== closure?.commitSha) {
    reasons.push("closure commit SHA does not match prerequisite evidence");
  }
  if (prerequisite?.runId !== closure?.runId) {
    reasons.push("closure runId does not match prerequisite evidence");
  }
  if (prerequisite?.migrationLedger?.fingerprint !== closure?.migrationLedger?.fingerprint) {
    reasons.push("closure migration ledger does not match prerequisite evidence");
  }
  return {
    valid: reasons.length === 0,
    reasons,
    commitSha: closure?.commitSha ?? null,
    runId: closure?.runId ?? null,
    migrationLedgerFingerprint: closure?.migrationLedger?.fingerprint ?? null,
  };
}

export function evaluateActivationPreflight({
  stage = "closure",
  routes,
  schemaCatalog,
  serviceSchemaCatalog = null,
  relations = [],
  migrations,
  releaseEvidence,
  privacy,
  continuity = null,
}) {
  const failedRoutes = routes.filter((route) => !route.ok).map((route) => route.path);
  const schemaAvailable = schemaCatalog?.state === "available";
  const catalogRelations = new Set(schemaCatalog?.relations ?? []);
  const catalogRpcs = new Set(schemaCatalog?.rpcs ?? []);
  const serviceCatalogAvailable = serviceSchemaCatalog?.state === "available";
  const serviceCatalogRpcs = new Set(serviceSchemaCatalog?.rpcs ?? []);
  const missingCoreRelations = schemaAvailable
    ? CORE_RELATIONS.filter((relation) => !catalogRelations.has(relation))
    : [];
  const missingAuthenticatedRpcs = schemaAvailable
    ? AUTHENTICATED_RPCS.filter((rpc) => !catalogRpcs.has(rpc))
    : [];
  const missingServiceRpcs = serviceCatalogAvailable
    ? SERVICE_ROLE_RPCS.filter((rpc) => !serviceCatalogRpcs.has(rpc))
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
    ...(serviceCatalogAvailable ? [] : ["Supabase service-role schema catalog is unavailable; valid service RPC evidence is required"]),
    ...missingCoreRelations.map((relation) => `core relation missing from schema catalog: ${relation}`),
    ...missingAuthenticatedRpcs.map((rpc) => `authenticated RPC missing from authenticated schema catalog: ${rpc}`),
    ...missingServiceRpcs.map((rpc) => `service-role RPC missing from service-role schema catalog: ${rpc}`),
    ...coreAccessUnknown.map((relation) => `authenticated preview read failed: ${relation}`),
    ...((migrations?.missing?.length ?? 0) > 0
      ? [`local migration source missing: ${migrations.missing.join(", ")}`]
      : []),
    ...(releaseEvidence?.valid ? [] : (releaseEvidence?.reasons ?? ["release evidence is not valid"])),
    ...(stage === "closure" && continuity && !continuity.valid ? continuity.reasons : []),
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

  const blockers = blockersFromReasons(reasons, stage);
  return {
    ready: reasons.length === 0,
    reasons,
    blockers,
    coreSchema: {
      missing: missingCoreRelations,
      unknown: schemaAvailable ? [] : [...CORE_RELATIONS],
      accessUnknown: coreAccessUnknown,
      rpcMissing: [...missingAuthenticatedRpcs, ...missingServiceRpcs],
      authenticatedRpcMissing: missingAuthenticatedRpcs,
      serviceRpcMissing: missingServiceRpcs,
      catalog: schemaCatalog?.state ?? "unknown",
      serviceCatalog: serviceSchemaCatalog?.state ?? "unknown",
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
  stage = "closure",
  baseUrl,
  supabaseUrl,
  supabaseAnonKey,
  supabaseJwt,
  supabaseServiceRoleKey,
  root = process.cwd(),
  env = process.env,
}) {
  if (!ACTIVATION_STAGES.includes(stage)) throw new Error(`unsupported activation stage: ${stage}`);
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
  const authenticatedSchemaCatalog = configuredSupabase
    ? await probeSchemaCatalog(normalizedSupabaseUrl, supabaseAnonKey, supabaseJwt)
    : {
        state: "unknown",
        status: null,
        relations: [],
        rpcs: [],
        reason: "Supabase URL, anon key, and scoped preview JWT are required",
      };
  const serviceSchemaCatalog = configuredSupabase && supabaseServiceRoleKey
    ? await probeSchemaCatalog(normalizedSupabaseUrl, supabaseServiceRoleKey, supabaseServiceRoleKey)
    : null;
  const schemaCatalog = authenticatedSchemaCatalog;
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
  const manifestPath = env.ACT001_EVIDENCE_MANIFEST ?? env.ACT001_PREFLIGHT_EVIDENCE;
  const prerequisiteEvidence = loadReleaseEvidence(
    root,
    manifestPath,
    normalizedBaseUrl,
    "prerequisite",
    REQUIRED_MIGRATIONS,
  );
  const closureEvidence = stage === "closure"
    ? loadReleaseEvidence(
        root,
        env.ACT001_CLOSURE_EVIDENCE ?? manifestPath,
        normalizedBaseUrl,
        "closure",
        REQUIRED_MIGRATIONS,
      )
    : null;
  const releaseEvidence = stage === "closure" ? closureEvidence : prerequisiteEvidence;
  const continuity = stage === "closure"
    ? validateClosureContinuity(prerequisiteEvidence, closureEvidence)
    : null;
  const privacy = privacyGate(root, releaseEvidence);
  const gates = evaluateActivationPreflight({
    stage,
    routes,
    schemaCatalog,
    serviceSchemaCatalog,
    relations,
    migrations,
    releaseEvidence,
    privacy,
    continuity,
  });
  return {
    stage,
    target: normalizedBaseUrl,
    supabase: {
      configured: configuredSupabase,
      authenticatedPreview: Boolean(supabaseJwt),
      url: normalizedSupabaseUrl,
      schemaCatalog,
      serviceSchemaCatalog,
    },
    routes,
    relations,
    migrations,
    releaseEvidence,
    prerequisiteEvidence,
    ...(closureEvidence ? { closureEvidence, continuity } : {}),
    privacy,
    gates,
    readOnly: true,
  };
}

const HELP = `Usage: node scripts/plus-activation-preflight.mjs <prerequisite|closure> [--json]\n\n` +
  `prerequisite  Verify preview release, schema, RPC, privacy, and migration prerequisites.\n` +
  `closure       Verify post-payment evidence and continuity with the prerequisite run.\n` +
  `--json        Print a machine-readable report.\n` +
  `--help        Show this help.`;

export function parseCliArgs(args) {
  args = args.filter((arg) => arg !== "--");
  if (args.includes("--help") || args.includes("-h")) return { help: true, json: args.includes("--json") };
  const unknown = args.filter((arg) => !ACTIVATION_STAGES.includes(arg) && arg !== "--json");
  const stages = args.filter((arg) => ACTIVATION_STAGES.includes(arg));
  if (unknown.length > 0) throw new Error(`unknown argument: ${unknown.join(", ")}`);
  if (stages.length !== 1) throw new Error("exactly one stage is required: prerequisite or closure");
  return { help: false, json: args.includes("--json"), stage: stages[0] };
}

export function missingEnvironment(env, stage) {
  const missing = [
    "ACT001_PREFLIGHT_BASE_URL",
    "ACT001_PREFLIGHT_SUPABASE_URL",
    "ACT001_PREFLIGHT_SUPABASE_ANON_KEY",
    "ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT",
    "ACT001_PREFLIGHT_SUPABASE_SERVICE_ROLE_KEY",
  ].filter((name) => !env[name]?.trim());
  const hasManifest = Boolean(env.ACT001_EVIDENCE_MANIFEST?.trim());
  const hasPrerequisite = Boolean(env.ACT001_PREFLIGHT_EVIDENCE?.trim());
  const hasClosure = Boolean(env.ACT001_CLOSURE_EVIDENCE?.trim());
  if (!hasManifest && !hasPrerequisite) missing.push("ACT001_EVIDENCE_MANIFEST");
  if (stage === "closure" && !hasManifest && !hasClosure) missing.push("ACT001_CLOSURE_EVIDENCE");
  return missing;
}

function missingEnvironmentReport(stage, missing) {
  const blockers = missing.map((name) => makeBlocker(
    "ACT001_ENV_MISSING",
    stage,
    `required environment variable is missing: ${name}`,
    `Set ${name} without printing its value, then rerun ${stage}.`,
    true,
  ));
  return {
    stage,
    ready: false,
    status: "BLOCKED",
    missingEnvironment: missing,
    blockers,
    readOnly: true,
  };
}

function printReport(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const ready = report.gates?.ready ?? report.ready;
  console.log(`ACT-001 ${report.stage} ${ready ? "READY" : "BLOCKED"}`);
  for (const blocker of report.gates?.blockers ?? report.blockers ?? []) {
    console.log(`- [${blocker.code}] ${blocker.message}`);
    console.log(`  next: ${blocker.nextAction}`);
  }
  if (report.gates?.supportingDegraded?.length > 0) {
    console.log(`supportingDegraded=${report.gates.supportingDegraded.join(",")}`);
  }
  if (report.target) console.log(`readOnly=${report.readOnly} target=${report.target}`);
}

async function main() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "invalid arguments");
    console.error(HELP);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(HELP);
    return;
  }
  const missing = missingEnvironment(process.env, options.stage);
  if (missing.length > 0) {
    printReport(missingEnvironmentReport(options.stage, missing), options.json);
    process.exitCode = 1;
    return;
  }
  const report = await runPreflight({
    stage: options.stage,
    baseUrl: process.env.ACT001_PREFLIGHT_BASE_URL,
    supabaseUrl: process.env.ACT001_PREFLIGHT_SUPABASE_URL,
    supabaseAnonKey: process.env.ACT001_PREFLIGHT_SUPABASE_ANON_KEY,
    supabaseJwt: process.env.ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT,
    supabaseServiceRoleKey: process.env.ACT001_PREFLIGHT_SUPABASE_SERVICE_ROLE_KEY,
  });
  printReport(report, options.json);
  if (!report.gates.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "ACT-001-RC preflight failed");
    process.exitCode = 1;
  });
}
