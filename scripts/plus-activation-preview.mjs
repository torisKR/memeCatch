#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const REQUIRED_CREDENTIALS = [
  "ACT001_PREVIEW_SUPABASE_ANON_KEY",
  "ACT001_PREVIEW_SUPABASE_SERVICE_ROLE_KEY",
  "ACT001_PREVIEW_REFUND_SERVICE_ROLE_KEY",
  "ACT001_PREVIEW_OWNER_JWT",
  "ACT001_PREVIEW_FREE_JWT",
  "ACT001_PREVIEW_EXPIRED_JWT",
  "ACT001_PREVIEW_CROSS_OWNER_JWT",
];

const REQUIRED_BOUNDARY_ENV = [
  "ACT001_PRODUCTION_APP_ORIGIN",
  "ACT001_PRODUCTION_SUPABASE_ORIGIN",
];

const HELP = `Usage: node scripts/plus-activation-preview.mjs --manifest <path> [--json]\n\n` +
  `Runs the ACT-001 write matrix only against an explicitly isolated preview target.\n` +
  `Credentials are read from ACT001_PREVIEW_* environment variables and are never printed.\n` +
  `--json is the canonical evidence output.`;

function blocker(code, message, nextAction, retryable = true) {
  return { code, stage: "preview", message, nextAction, retryable };
}

export function parsePreviewArgs(args) {
  args = args.filter((arg) => arg !== "--");
  if (args.includes("--help") || args.includes("-h")) return { help: true, json: args.includes("--json") };
  const json = args.includes("--json");
  const manifestIndex = args.indexOf("--manifest");
  const manifest = manifestIndex >= 0 ? args[manifestIndex + 1] : null;
  const consumed = new Set(["--json"]);
  if (manifestIndex >= 0) {
    consumed.add("--manifest");
    if (manifest) consumed.add(manifest);
  }
  const unknown = args.filter((arg) => !consumed.has(arg));
  if (unknown.length > 0) throw new Error(`unknown argument: ${unknown.join(", ")}`);
  if (!manifest || manifest.startsWith("--")) throw new Error("--manifest <path> is required");
  return { help: false, json, manifest };
}

function parseJwtSubject(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" && payload.sub.trim() ? payload.sub : null;
  } catch {
    return null;
  }
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/"
    ) return null;
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isRealProviderId(value) {
  return typeof value === "string"
    && value.trim().length >= 6
    && !/(?:^|[-_])(act001|fake|synthetic|mock)(?:[-_]|$)/iu.test(value.trim());
}

export function validateRealPaymentEvidence(payment) {
  const blockers = [];
  if (payment?.provider !== "unifi" || payment?.mode !== "test" || payment?.verified !== true) {
    blockers.push(blocker(
      "ACT001_REAL_PAYMENT_EVIDENCE_MISSING",
      "verified Unifi test payment evidence is required",
      "Complete the real browser checkout and attach its redacted evidence.",
      false,
    ));
    return blockers;
  }
  if (
    payment.browserArtifact?.source !== "browser.md"
    || !/^[0-9a-f]{64}$/iu.test(payment.browserArtifact?.sha256 ?? "")
  ) {
    blockers.push(blocker(
      "ACT001_BROWSER_EVIDENCE_MISSING",
      "canonical redacted browser.md evidence is required",
      "Record the real browser checkout in browser.md and include its SHA-256.",
      false,
    ));
  }
  const contracts = [["confirmed", "CONFIRMED", ["requestId", "providerLinkId", "transactionId"]]];
  if (payment.canceled) {
    contracts.push(["canceled", "CANCELED", ["requestId", "providerLinkId", "transactionId"]]);
  }
  if (payment.refunded) {
    contracts.push(["refunded", "REFUNDED", ["requestId", "providerLinkId", "transactionId", "refundTransactionId"]]);
  }
  for (const [name, status, fields] of contracts) {
    const evidence = payment[name];
    if (evidence?.status !== status) {
      blockers.push(blocker(
        "ACT001_REAL_PAYMENT_EVIDENCE_MISSING",
        `real ${name} transaction status ${status} is required`,
        `Attach the actual provider-backed ${name} transaction evidence.`,
        false,
      ));
      continue;
    }
    for (const field of fields) {
      if (!isRealProviderId(evidence[field])) {
        blockers.push(blocker(
          "ACT001_SYNTHETIC_TRANSACTION_REFUSED",
          `${name}.${field} is missing or synthetic`,
          "Use only the identifier returned by the real Unifi test transaction.",
          false,
        ));
      }
    }
  }
  if (payment.refunded && (
    payment.refunded.transactionId !== payment.confirmed?.transactionId
    || payment.refunded.providerLinkId !== payment.confirmed?.providerLinkId
    || payment.refunded.requestId !== payment.confirmed?.requestId
  )) {
    blockers.push(blocker(
      "ACT001_REFUND_TRANSACTION_MISMATCH",
      "refund evidence must reference the same real confirmed transaction",
      "Use the real provider refund identity for the confirmed browser transaction.",
      false,
    ));
  }
  if (typeof payment.receipt?.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(payment.receipt.id)) {
    blockers.push(blocker(
      "ACT001_RECEIPT_EVIDENCE_MISSING",
      "owner receipt evidence is required before refund verification",
      "Complete the real receipt flow and record its redacted receipt identifier.",
      false,
    ));
  }
  if (payment.receipt?.mode !== "one_cut" || payment.receipt?.refreshReadBack !== true) {
    blockers.push(blocker(
      "ACT001_RECEIPT_EVIDENCE_MISSING",
      "receipt evidence must confirm mode=one_cut and browser refresh/read-back",
      "Complete the trusted one-cut receipt and verify it after browser refresh.",
      false,
    ));
  }
  if (payment.refunded && (
    payment.receipt?.idempotencyVerified !== true
    || payment.receipt?.conflictVerified !== true
  )) {
    blockers.push(blocker(
      "ACT001_RECEIPT_CONFLICT_EVIDENCE_MISSING",
      "receipt idempotency and conflict evidence must precede the real provider refund",
      "Record both checks in browser.md before refunding the transaction.",
      false,
    ));
  }
  return blockers;
}

export function validateBrowserArtifact(manifest, manifestDirectory) {
  const artifact = manifest?.payment?.browserArtifact;
  if (artifact?.source !== "browser.md") {
    return [blocker("ACT001_BROWSER_EVIDENCE_MISSING", "browser.md evidence is required", "Create browser.md in the evidence directory.", false)];
  }
  try {
    const root = realpathSync(manifestDirectory);
    const path = realpathSync(resolve(root, artifact.source));
    const rel = relative(root, path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !existsSync(path)) throw new Error("outside evidence root");
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (hash !== artifact.sha256.toLowerCase()) throw new Error("hash mismatch");
    return [];
  } catch {
    return [blocker(
      "ACT001_BROWSER_EVIDENCE_INVALID",
      "browser.md is missing, outside the evidence directory, or has a SHA-256 mismatch",
      "Regenerate the redacted browser artifact and manifest hash.",
      false,
    )];
  }
}

export function validatePreviewBoundary(manifest, env = process.env) {
  const blockers = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return [blocker("ACT001_MANIFEST_INVALID", "manifest must be a JSON object", "Create a redacted preview manifest.", false)];
  }
  if (manifest.environment !== "preview") {
    blockers.push(blocker(
      "ACT001_PRODUCTION_REFUSED",
      "manifest environment must be preview",
      "Use an isolated preview manifest; production execution is forbidden.",
      false,
    ));
  }
  const expectedPreviewApp = normalizeOrigin(env.ACT001_PREVIEW_APP_ORIGIN ?? env.ACT001_PREFLIGHT_BASE_URL);
  const expectedPreviewSupabase = normalizeOrigin(
    env.ACT001_PREVIEW_SUPABASE_ORIGIN ?? env.ACT001_PREFLIGHT_SUPABASE_URL,
  );
  const productionApp = normalizeOrigin(env.ACT001_PRODUCTION_APP_ORIGIN);
  const productionSupabase = normalizeOrigin(env.ACT001_PRODUCTION_SUPABASE_ORIGIN);
  const manifestApp = normalizeOrigin(manifest.appUrl);
  const manifestSupabase = normalizeOrigin(manifest.supabaseUrl);
  for (const name of REQUIRED_BOUNDARY_ENV) {
    if (!env[name]?.trim()) {
      blockers.push(blocker(
        "ACT001_PRODUCTION_BOUNDARY_MISSING",
        `required production boundary is missing: ${name}`,
        `Set ${name} to the exact production origin before preview execution.`,
        false,
      ));
    }
  }
  if (!expectedPreviewApp || !expectedPreviewSupabase) {
    blockers.push(blocker(
      "ACT001_PREVIEW_BOUNDARY_MISSING",
      "explicit preview app and Supabase origins are required",
      "Set ACT001_PREVIEW_APP_ORIGIN and ACT001_PREVIEW_SUPABASE_ORIGIN to exact origins.",
      false,
    ));
  }
  if (manifestApp !== expectedPreviewApp || manifestSupabase !== expectedPreviewSupabase) {
    blockers.push(blocker(
      "ACT001_PREVIEW_BOUNDARY_MISMATCH",
      "manifest origins do not exactly match the expected preview origins",
      "Regenerate the manifest for the configured isolated preview origins.",
      false,
    ));
  }
  if (
    !productionApp
    || !productionSupabase
    || expectedPreviewApp === productionApp
    || expectedPreviewSupabase === productionSupabase
  ) {
    blockers.push(blocker(
      "ACT001_PRODUCTION_REFUSED",
      "preview and production origins must be valid and distinct",
      "Configure exact, distinct preview and production origins.",
      false,
    ));
  }
  if (typeof manifest.runId !== "string" || !/^[a-z0-9][a-z0-9._-]{5,127}$/iu.test(manifest.runId)) {
    blockers.push(blocker("ACT001_RUN_ID_INVALID", "manifest runId is missing or invalid", "Use the prerequisite runId unchanged.", false));
  }
  if (typeof manifest.commitSha !== "string" || !/^[0-9a-f]{40}$/iu.test(manifest.commitSha)) {
    blockers.push(blocker("ACT001_SHA_INVALID", "manifest commitSha is missing or invalid", "Use the clean prerequisite commit SHA.", false));
  }
  if (typeof manifest.memeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(manifest.memeId)) {
    blockers.push(blocker("ACT001_FIXTURE_INVALID", "manifest memeId is missing or invalid", "Provide one reviewed/current preview fixture UUID.", false));
  }
  if (manifest.locale !== "en") {
    blockers.push(blocker("ACT001_FIXTURE_INVALID", "manifest locale must be en", "Use the reviewed/current English fixture.", false));
  }
  blockers.push(...validateRealPaymentEvidence(manifest.payment));
  return blockers;
}

export function missingPreviewCredentials(env = process.env) {
  return REQUIRED_CREDENTIALS.filter((name) => !env[name]?.trim()).sort();
}

function parseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function errorText(data) {
  return typeof data === "string" ? data : JSON.stringify(data);
}

async function request(baseUrl, path, { key, token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    redirect: "manual",
    headers: {
      apikey: key,
      authorization: `Bearer ${token ?? key}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: parseBody(text) };
}

function assertResult(condition, message) {
  if (!condition) throw new Error(message);
}

async function rpc(context, name, token, body, key = context.anonKey) {
  return request(context.baseUrl, `/rest/v1/rpc/${name}`, { key, token, method: "POST", body });
}

async function expectRpcError(context, name, token, body, expected, key) {
  const result = await rpc(context, name, token, body, key);
  assertResult(!result.ok && errorText(result.data).includes(expected), `${name} did not reject with ${expected}`);
}

async function expectRpcOk(context, name, token, body, key) {
  const result = await rpc(context, name, token, body, key);
  assertResult(result.ok, `${name} failed (${result.status})`);
  return result.data;
}

async function readRows(context, table, filters, { key = context.serviceKey, token = key } = {}) {
  const search = new URLSearchParams({ select: "*", ...filters });
  const result = await request(context.baseUrl, `/rest/v1/${table}?${search}`, { key, token });
  assertResult(result.ok && Array.isArray(result.data), `${table} state read failed (${result.status})`);
  return result.data;
}

function expectSingleRow(rows, predicate, message) {
  assertResult(rows.length === 1 && predicate(rows[0]), message);
  return rows[0];
}

function expectFailClosedRead(result, message) {
  assertResult(
    (result.ok && Array.isArray(result.data) && result.data.length === 0)
      || (!result.ok && [401, 403].includes(result.status)),
    message,
  );
}

export async function runAccessBoundaryMatrix({ context, manifest, owner, crossOwner }) {
  const confirmed = manifest.payment.confirmed;
  const receiptId = manifest.payment.receipt.id;
  const signedOutOrder = await request(
    context.baseUrl,
    `/rest/v1/billing_orders?select=id&transaction_id=eq.${encodeURIComponent(confirmed.transactionId)}`,
    { key: context.anonKey, token: context.anonKey },
  );
  expectFailClosedRead(signedOutOrder, "signed-out billing order read did not fail closed");

  const signedOutReceipt = await request(
    context.baseUrl,
    `/rest/v1/plus_meme_use_receipts?select=id&id=eq.${encodeURIComponent(receiptId)}`,
    { key: context.anonKey, token: context.anonKey },
  );
  expectFailClosedRead(signedOutReceipt, "signed-out receipt read did not fail closed");

  const crossOwnerOrder = await request(
    context.baseUrl,
    `/rest/v1/billing_orders?select=id&transaction_id=eq.${encodeURIComponent(confirmed.transactionId)}`,
    { key: context.anonKey, token: crossOwner },
  );
  expectFailClosedRead(crossOwnerOrder, "cross-owner billing order read did not fail closed");

  const probeId = `permission-probe-${manifest.commitSha.toLowerCase()}`;
  const refundDenial = await rpc(context, "reconcile_unifi_refund", owner, {
    p_transaction_id: probeId,
    p_refund_transaction_id: probeId,
    p_occurred_at: new Date(0).toISOString(),
    p_payload: { act001: "redacted-permission-probe" },
  });
  const denialText = errorText(refundDenial.data);
  assertResult(
    !refundDenial.ok
      && ([401, 403].includes(refundDenial.status)
        || /permission denied|PGRST202|could not find the function/iu.test(denialText)),
    "authenticated principal can reach the refund RPC",
  );

  return {
    signedOutBillingReadDenied: true,
    signedOutReceiptReadDenied: true,
    crossOwnerBillingOrderReadDenied: true,
    authenticatedRefundRpcDenied: true,
    runId: manifest.runId,
    commitSha: manifest.commitSha.toLowerCase(),
  };
}

export async function runPreviewMatrix({ manifest, env = process.env }) {
  const subjects = Object.fromEntries([
    ["owner", env.ACT001_PREVIEW_OWNER_JWT],
    ["free", env.ACT001_PREVIEW_FREE_JWT],
    ["expired", env.ACT001_PREVIEW_EXPIRED_JWT],
    ["crossOwner", env.ACT001_PREVIEW_CROSS_OWNER_JWT],
  ].map(([name, token]) => [name, parseJwtSubject(token)]));
  assertResult(Object.values(subjects).every(Boolean), "all principal JWTs must contain a subject");
  assertResult(new Set(Object.values(subjects)).size === 4, "owner/free/expired/cross-owner principals must be distinct");

  const context = {
    baseUrl: new URL(manifest.supabaseUrl).origin,
    anonKey: env.ACT001_PREVIEW_SUPABASE_ANON_KEY,
    serviceKey: env.ACT001_PREVIEW_SUPABASE_SERVICE_ROLE_KEY,
  };
  const owner = env.ACT001_PREVIEW_OWNER_JWT;
  const free = env.ACT001_PREVIEW_FREE_JWT;
  const expired = env.ACT001_PREVIEW_EXPIRED_JWT;
  const crossOwner = env.ACT001_PREVIEW_CROSS_OWNER_JWT;
  const refundService = env.ACT001_PREVIEW_REFUND_SERVICE_ROLE_KEY;
  const confirmedEvidence = manifest.payment.confirmed;
  const canceledEvidence = manifest.payment.canceled;
  const refundedEvidence = manifest.payment.refunded;
  const expectedConfirmedStatus = refundedEvidence ? "REFUNDED" : "CONFIRMED";

  const accessBoundary = await runAccessBoundaryMatrix({
    context,
    manifest,
    owner,
    crossOwner,
  });

  const confirmedOrder = expectSingleRow(
    await readRows(context, "billing_orders", { transaction_id: `eq.${confirmedEvidence.transactionId}` }),
    (row) => row.user_id === subjects.owner
      && row.request_id === confirmedEvidence.requestId
      && row.provider_link_id === confirmedEvidence.providerLinkId
      && row.status === expectedConfirmedStatus,
    "real confirmed Unifi order state does not match the owner evidence",
  );
  if (canceledEvidence) {
    expectSingleRow(
      await readRows(context, "billing_orders", { transaction_id: `eq.${canceledEvidence.transactionId}` }),
      (row) => row.request_id === canceledEvidence.requestId
        && row.provider_link_id === canceledEvidence.providerLinkId
        && row.status === "CANCELED",
      "real canceled Unifi order state does not match the provider evidence",
    );
  }
  if (refundedEvidence) {
    expectSingleRow(
      await readRows(
        context,
        "billing_orders",
        { transaction_id: `eq.${refundedEvidence.transactionId}` },
        { key: refundService, token: refundService },
      ),
      (row) => row.id === confirmedOrder.id
        && row.refund_transaction_id === refundedEvidence.refundTransactionId
        && row.status === "REFUNDED",
      "real refunded Unifi order state does not match the same provider transaction",
    );
  }
  expectSingleRow(
    await readRows(context, "billing_subscriptions", {
      provider: "eq.unifi",
      external_order_id: `eq.${confirmedEvidence.providerLinkId}`,
    }),
    (row) => row.user_id === subjects.owner
      && row.status === (refundedEvidence ? "canceled" : "active"),
    "real confirmed/refunded order entitlement state is inconsistent",
  );
  expectSingleRow(
    await readRows(context, "billing_webhook_events", {
      event_key: `eq.unifi-order:${confirmedEvidence.transactionId}:CONFIRMED`,
    }),
    (row) => row.matched_user_id === subjects.owner,
    "duplicate webhook ledger must contain exactly one owner-bound event",
  );
  assertResult(confirmedOrder.provider === "unifi", "confirmed order provider is not Unifi");

  expectSingleRow(
    await readRows(context, "plus_meme_use_receipts", { id: `eq.${manifest.payment.receipt.id}` }),
    (row) => row.user_id === subjects.owner
      && row.meme_id === manifest.memeId
      && row.mode === "one_cut",
    "real owner receipt evidence is missing or owner-mismatched",
  );

  const receiptInput = {
    p_meme_id: manifest.memeId,
    p_locale: "en",
    p_channel: manifest.payment.receipt.channel ?? "threads",
    p_artifact_kind: manifest.payment.receipt.artifactKind ?? "creator_pack",
    p_result_url: manifest.payment.receipt.resultUrl ?? null,
    p_performance_note: manifest.payment.receipt.performanceNote ?? null,
    p_private_note: manifest.payment.receipt.privateNote ?? null,
    p_mode: "one_cut",
  };
  await expectRpcError(context, "record_plus_meme_use_receipt", free, receiptInput, "plus_required");
  const expiredReceipt = await rpc(context, "record_plus_meme_use_receipt", expired, receiptInput);
  assertResult(!expiredReceipt.ok && [401, 403].includes(expiredReceipt.status), "expired principal was not rejected");
  if (!refundedEvidence) {
    const idempotentReceipt = await expectRpcOk(
      context,
      "record_plus_meme_use_receipt",
      owner,
      receiptInput,
    );
    assertResult(
      idempotentReceipt?.receipt_id === manifest.payment.receipt.id
        && idempotentReceipt?.already_recorded === true,
      "owner receipt retry did not return the same idempotent receipt",
    );
    await expectRpcError(context, "record_plus_meme_use_receipt", owner, { ...receiptInput, p_channel: "x" }, "receipt_conflict");
  }

  const crossRows = await request(context.baseUrl, `/rest/v1/plus_meme_use_receipts?select=id&id=eq.${manifest.payment.receipt.id}`, {
    key: context.anonKey,
    token: crossOwner,
  });
  assertResult(crossRows.ok && Array.isArray(crossRows.data) && crossRows.data.length === 0, "cross-owner receipt isolation failed");

  return {
    status: "READ_MATRIX_PASS",
    stage: "preview",
    provider: "unifi",
    environment: "preview",
    runId: manifest.runId,
    commitSha: manifest.commitSha.toLowerCase(),
    migrationLedger: manifest.migrationLedger,
    principals: Object.keys(subjects),
    matrix: [
      "confirmed-order",
      "duplicate-webhook-ledger",
      "transaction-owner-binding",
      ...(canceledEvidence ? ["canceled-order-provider-evidence"] : ["canceled-order-contract-only"]),
      ...(refundedEvidence ? ["refunded-order-provider-evidence"] : ["refund-contract-only"]),
      ...(refundedEvidence
        ? ["receipt-idempotency-browser-evidence", "receipt-conflict-browser-evidence"]
        : ["receipt-idempotency-rpc", "receipt-conflict-rpc"]),
      "cross-owner-rls",
      "signed-out-billing-read-denied",
      "signed-out-receipt-read-denied",
      "cross-owner-billing-order-read-denied",
      "authenticated-refund-rpc-denied",
    ],
    accessBoundary,
    claims: {
      browserRefresh: false,
      analyticsDelivery: false,
      providerE2e: false,
    },
    redacted: true,
  };
}

export function formatTextReport(report) {
  const lines = [`ACT-001 preview ${report.status}`];
  for (const item of report.blockers ?? []) lines.push(`- [${item.code}] ${item.message}`);
  if (report.claims) {
    lines.push(`providerE2e=${report.claims.providerE2e}`);
    lines.push(`browserRefresh=${report.claims.browserRefresh}`);
    lines.push(`analyticsDelivery=${report.claims.analyticsDelivery}`);
    lines.push("limitations=read-matrix-only; closure requires separate browser/provider/analytics artifacts");
  }
  return lines.join("\n");
}

function print(report, json) {
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatTextReport(report));
}

async function main() {
  let options;
  try { options = parsePreviewArgs(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : "invalid arguments");
    console.error(HELP);
    process.exitCode = 2;
    return;
  }
  if (options.help) { console.log(HELP); return; }

  let manifest;
  try { manifest = JSON.parse(readFileSync(resolve(options.manifest), "utf8")); }
  catch {
    print({
      status: "BLOCKED",
      stage: "preview",
      blockers: [blocker("ACT001_MANIFEST_INVALID", "manifest is missing or invalid JSON", "Regenerate the redacted prerequisite manifest.", false)],
      redacted: true,
    }, options.json);
    process.exitCode = 1;
    return;
  }
  const boundaryBlockers = validatePreviewBoundary(manifest, process.env);
  const artifactBlockers = validateBrowserArtifact(manifest, dirname(resolve(options.manifest)));
  if (boundaryBlockers.length > 0 || artifactBlockers.length > 0) {
    print({
      status: "BLOCKED",
      stage: "preview",
      blockers: [...boundaryBlockers, ...artifactBlockers],
      redacted: true,
    }, options.json);
    process.exitCode = 1;
    return;
  }
  const missing = missingPreviewCredentials(process.env);
  if (missing.length > 0) {
    const report = {
      status: "BLOCKED",
      stage: "preview",
      blockers: missing.map((name) => blocker(
        "ACT001_CREDENTIAL_MISSING",
        `required credential is missing: ${name}`,
        `Set ${name} securely and rerun the same manifest.`,
      )),
      redacted: true,
    };
    print(report, options.json);
    process.exitCode = 1;
    return;
  }
  const report = await runPreviewMatrix({ manifest });
  print(report, options.json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    print({
      status: "BLOCKED",
      stage: "preview",
      blockers: [blocker("ACT001_MATRIX_FAILED", error instanceof Error ? error.message : "preview matrix failed", "Inspect the redacted failure and retry the same run.")],
      redacted: true,
    }, process.argv.includes("--json"));
    process.exitCode = 1;
  });
}
