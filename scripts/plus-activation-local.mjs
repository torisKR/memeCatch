#!/usr/bin/env node

import { randomUUID } from "node:crypto";

let baseUrl = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY?.trim();
const memeId = "00000000-0000-0000-0000-000000000001";
const runId = randomUUID().replaceAll("-", "").slice(0, 10);
const password = `Act001-${randomUUID()}aA1!`;
const users = {
  active: { email: `act001-active-${runId}@local.test`, nickname: `act${runId.slice(0, 8)}` },
  free: { email: `act001-free-${runId}@local.test`, nickname: `free${runId.slice(0, 8)}` },
  other: { email: `act001-other-${runId}@local.test`, nickname: `other${runId.slice(0, 7)}` },
};
const createdUserIds = [];
let insertedTranslation = false;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertLocalUrl() {
  const url = new URL(baseUrl);
  assert(
    url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.port === "54321" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === "",
    "LOCAL_SUPABASE_URL must point to http://127.0.0.1:54321 or http://localhost:54321",
  );
  baseUrl = url.origin;
}

function assertLocalJwt(key, expectedRole, label) {
  const parts = key.split(".");
  assert(parts.length === 3, `${label} must be a JWT`);
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    fail(`${label} JWT payload is invalid`);
  }
  assert(payload?.iss === "supabase-demo", `${label} is not a local Supabase key`);
  assert(payload?.role === expectedRole, `${label} role must be ${expectedRole}`);
  assert(Number.isFinite(payload?.exp) && payload.exp * 1000 > Date.now(), `${label} is expired`);
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path, { key, token, method = "GET", body, headers = {} } = {}) {
  const authorization = token
    ? `Bearer ${token}`
    : key === serviceRoleKey && serviceRoleKey
      ? `Bearer ${serviceRoleKey}`
      : undefined;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: key ?? serviceRoleKey,
      ...(authorization ? { authorization } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    redirect: "manual",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, data: parseBody(text), text };
}

function expectOk(result, label) {
  assert(result.response.ok, `${label} failed (${result.response.status})`);
  return result.data;
}

async function createUser(user) {
  const result = await request("/auth/v1/admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: {
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { nickname: user.nickname },
    },
  });
  const data = expectOk(result, "create local auth user");
  assert(typeof data?.id === "string", "local auth user did not return an id");
  createdUserIds.push(data.id);
  user.id = data.id;
  return data.id;
}

async function setPlus(email, active) {
  const data = expectOk(
    await request("/rest/v1/rpc/admin_set_plus_entitlement", {
      key: serviceRoleKey,
      method: "POST",
      body: { p_email: email, p_active: active, p_months: 1 },
    }),
    `set local Plus ${active ? "active" : "inactive"}`,
  );
  assert(data?.status === (active ? "active" : "canceled"), "local Plus status mismatch");
}

async function signIn(user) {
  const result = await request("/auth/v1/token?grant_type=password", {
    key: anonKey,
    method: "POST",
    body: { email: user.email, password },
  });
  const data = expectOk(result, "sign in local test user");
  assert(typeof data?.access_token === "string", "local sign-in did not return an access token");
  return data.access_token;
}

async function rpc(name, token, body) {
  return request(`/rest/v1/rpc/${name}`, {
    key: anonKey,
    token,
    method: "POST",
    body,
  });
}

async function prepareTranslation(activeUserId) {
  const sourceRows = expectOk(
    await request(`/rest/v1/memes?select=id,title,updated_at,moderation_status&id=eq.${memeId}`, {
      key: serviceRoleKey,
    }),
    "read local source fixture",
  );
  assert(Array.isArray(sourceRows) && sourceRows.length === 1, "local source fixture is missing");
  assert(sourceRows[0].moderation_status === "approved", "local source fixture is not public");

  const existingRows = expectOk(
    await request(`/rest/v1/meme_translations?select=meme_id&locale=eq.en&meme_id=eq.${memeId}`, {
      key: serviceRoleKey,
    }),
    "check local translation fixture",
  );
  assert(Array.isArray(existingRows) && existingRows.length === 0, "local translation fixture already exists");

  const translationResult = await request("/rest/v1/meme_translations", {
    key: serviceRoleKey,
    method: "POST",
    headers: { prefer: "return=representation" },
    body: {
      meme_id: memeId,
      locale: "en",
      localized_slug: "act001-local-fixture",
      title: "Local ACT-001 fixture",
      summary: "A reviewed local fixture for activation verification.",
      description: "This local-only fixture verifies that a current reviewed translation can reach the Plus use flow without changing production content.",
      origin: "Created only for the local ACT-001-lite verification.",
      usage_note: "Use only inside the local test flow.",
      caution: "This is not production content.",
      aliases: [],
      usage_examples: [{ situation: "local test", text: "Use the reviewed fixture in the local flow." }],
      status: "reviewed",
      source_updated_at: sourceRows[0].updated_at,
      provider: "local_test_fixture",
      model: "test-fixture",
      prompt_version: 1,
      reviewed_at: new Date().toISOString(),
      reviewed_by: activeUserId,
    },
  });
  expectOk(translationResult, "insert local reviewed translation fixture");
  insertedTranslation = true;
  const translation = translationResult.data;
  assert(Array.isArray(translation) && translation.length === 1, "local translation fixture was not inserted");
  return sourceRows[0];
}

async function cleanup() {
  const errors = [];
  const createdUserIdFilter = createdUserIds.join(",");
  if (insertedTranslation) {
    try {
      const deletion = await request(`/rest/v1/meme_translations?locale=eq.en&meme_id=eq.${memeId}`, {
        key: serviceRoleKey,
        method: "DELETE",
      });
      if (!deletion.response.ok) errors.push("translation fixture cleanup failed");
      const remaining = await request(`/rest/v1/meme_translations?select=meme_id&locale=eq.en&meme_id=eq.${memeId}`, {
        key: serviceRoleKey,
      });
      if (!remaining.response.ok || !Array.isArray(remaining.data) || remaining.data.length !== 0) {
        errors.push("translation fixture cleanup was not verified");
      }
    } catch {
      errors.push("translation fixture cleanup threw");
    }
  }
  for (const userId of createdUserIds.reverse()) {
    try {
      const deletion = await request(`/auth/v1/admin/users/${userId}`, {
        key: serviceRoleKey,
        method: "DELETE",
      });
      if (!deletion.response.ok) {
        errors.push("local auth user cleanup failed");
        continue;
      }
      const remaining = await request(`/auth/v1/admin/users/${userId}`, { key: serviceRoleKey });
      if (remaining.response.status !== 404) errors.push("local auth user cleanup was not verified");
    } catch {
      errors.push("local auth user cleanup threw");
    }
  }
  if (serviceRoleKey) {
    for (const [relation, label] of [
      ["plus_meme_use_receipts", "receipt"],
      ["plus_meme_use_completions", "completion"],
    ]) {
      try {
        const remaining = await request(
          `/rest/v1/${relation}?select=id&meme_id=eq.${memeId}&user_id=in.(${createdUserIdFilter})`,
          {
            key: serviceRoleKey,
          },
        );
        if (!remaining.response.ok || !Array.isArray(remaining.data) || remaining.data.length !== 0) {
          errors.push(`${label} fixture cleanup was not verified`);
        }
      } catch {
        errors.push(`${label} fixture cleanup threw`);
      }
    }
  }
  return errors;
}

async function run() {
  assertLocalUrl();
  assert(anonKey, "LOCAL_SUPABASE_ANON_KEY is required");
  assert(serviceRoleKey, "LOCAL_SUPABASE_SERVICE_ROLE_KEY is required");
  assertLocalJwt(anonKey, "anon", "LOCAL_SUPABASE_ANON_KEY");
  assertLocalJwt(serviceRoleKey, "service_role", "LOCAL_SUPABASE_SERVICE_ROLE_KEY");

  await createUser(users.active);
  await createUser(users.free);
  await createUser(users.other);
  await setPlus(users.active.email, true);
  await setPlus(users.other.email, true);
  const source = await prepareTranslation(users.active.id);
  const activeToken = await signIn(users.active);
  const freeToken = await signIn(users.free);
  const otherToken = await signIn(users.other);

  const receiptInput = {
    p_meme_id: memeId,
    p_locale: "en",
    p_channel: "threads",
    p_artifact_kind: "creator_pack",
    p_result_url: "https://local.test/act-001",
    p_performance_note: null,
    p_private_note: "local-only verification",
  };
  const freeReceipt = await rpc("record_plus_meme_use_receipt", freeToken, receiptInput);
  assert(!freeReceipt.response.ok && freeReceipt.text.includes("plus_required"), "free user was not blocked");
  console.log("PASS free user is blocked by plus_required");

  const firstReceipt = await rpc("record_plus_meme_use_receipt", activeToken, receiptInput);
  const firstData = expectOk(firstReceipt, "active Plus receipt creation");
  assert(firstData?.completed === true && firstData?.already_recorded === false, "first receipt was not created");
  assert(typeof firstData.receipt_id === "string", "first receipt has no id");
  console.log("PASS active Plus creates one reviewed/current English Creator Pack receipt");

  const secondReceipt = await rpc("record_plus_meme_use_receipt", activeToken, receiptInput);
  const secondData = expectOk(secondReceipt, "active Plus receipt retry");
  assert(secondData?.already_recorded === true && secondData.receipt_id === firstData.receipt_id, "receipt retry was not idempotent");
  console.log("PASS receipt retry is idempotent");

  const conflictingRetry = await rpc("record_plus_meme_use_receipt", activeToken, {
    ...receiptInput,
    p_channel: "x",
  });
  assert(
    !conflictingRetry.response.ok && conflictingRetry.text.includes("receipt_conflict"),
    "receipt retry with changed meaning fields was not rejected",
  );
  console.log("PASS changed receipt meaning fields are rejected without overwriting the owner record");

  const summary = expectOk(await rpc("get_plus_meme_use_outcome_summary", activeToken, {}), "active Plus outcome summary");
  assert(summary?.total_receipts === 1 && summary?.total_completions === 1, "outcome summary count mismatch");
  assert(summary?.awaiting_performance_count === 1, "outcome summary did not retain the follow-up");
  console.log("PASS outcome summary reports one receipt and one pending performance follow-up");

  const ownerRows = expectOk(
    await request(`/rest/v1/plus_meme_use_receipts?select=id,user_id,meme_id,locale,channel,artifact_kind,result_url`, {
      key: anonKey,
      token: activeToken,
    }),
    "active owner receipt read",
  );
  assert(
    Array.isArray(ownerRows) &&
      ownerRows.length === 1 &&
      ownerRows[0].user_id === users.active.id &&
      ownerRows[0].channel === receiptInput.p_channel &&
      ownerRows[0].artifact_kind === receiptInput.p_artifact_kind &&
      ownerRows[0].result_url === receiptInput.p_result_url,
    "active owner cannot read the canonical Creator Pack receipt",
  );
  console.log("PASS active owner reads exactly one own receipt");

  const otherRows = expectOk(
    await request("/rest/v1/plus_meme_use_receipts?select=id,user_id,meme_id,locale,channel,artifact_kind,result_url", {
      key: anonKey,
      token: otherToken,
    }),
    "cross-owner receipt read",
  );
  assert(Array.isArray(otherRows) && otherRows.length === 0, "cross-owner receipt was visible");
  console.log("PASS second active owner cannot read another owner's receipt");

  const freeSummary = await rpc("get_plus_meme_use_outcome_summary", freeToken, {});
  assert(!freeSummary.response.ok && freeSummary.text.includes("plus_required"), "free summary was not blocked");
  console.log("PASS free user cannot read the Plus outcome summary");

  await setPlus(users.active.email, false);
  const expiredReceipt = await rpc("record_plus_meme_use_receipt", activeToken, receiptInput);
  assert(!expiredReceipt.response.ok && expiredReceipt.text.includes("plus_required"), "inactive Plus user was not blocked");
  console.log("PASS canceled Plus user is blocked by plus_required");

  assert(source.id === memeId, "source fixture changed during the local flow");
}

let runError = null;
try {
  await run();
} catch (error) {
  runError = error instanceof Error ? error.message : "ACT-001-lite failed";
}
const cleanupErrors = serviceRoleKey ? await cleanup() : [];
if (runError) {
  console.error(runError);
  process.exitCode = 1;
} else if (cleanupErrors.length > 0) {
  console.error(cleanupErrors.join("; "));
  process.exitCode = 1;
} else {
  console.log("ACT-001-lite PASS");
}
