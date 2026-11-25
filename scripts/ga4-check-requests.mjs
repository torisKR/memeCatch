// Run only with an authorized Analytics Viewer service account.
import { spawnSync } from "node:child_process";
import { sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const tokenUrl = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/analytics.readonly";

async function exportManifest() {
  const directory = await mkdtemp(join(tmpdir(), "ga4-requests-"));
  try {
    const output = join(directory, "reports.json");
    const cargo = spawnSync("cargo", [
      "test", "--lib", "pages::admin::ga4::tests::export_request_bodies",
      "--", "--exact", "--ignored",
    ], {
      cwd: fileURLToPath(new URL("../server/", import.meta.url)),
      env: { ...process.env, CARGO_INCREMENTAL: "0", GA4_REQUEST_MANIFEST: output },
      stdio: "ignore",
    });
    if (cargo.status !== 0) throw new Error("Failed to export the server's GA4 request bodies");
    return JSON.parse(await readFile(output, "utf8"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function accessToken(path) {
  let assertion;
  try {
    const key = JSON.parse(await readFile(path, "utf8"));
    if (key.type !== "service_account" || !key.client_email?.endsWith(".gserviceaccount.com")) {
      throw new Error("invalid service account");
    }
    const now = Math.floor(Date.now() / 1000);
    const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
    const unsigned = [
      encode({ alg: "RS256", typ: "JWT" }),
      encode({ iss: key.client_email, scope, aud: tokenUrl, iat: now, exp: now + 3600 }),
    ].join(".");
    const signature = sign("RSA-SHA256", Buffer.from(unsigned), key.private_key).toString("base64url");
    assertion = `${unsigned}.${signature}`;
  } catch {
    throw new Error("Could not read or sign with the service account JSON");
  }
  const response = await fetch(tokenUrl, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { throw new Error("OAuth connection failed"); });
  if (!response.ok) throw new Error(`OAuth HTTP ${response.status}`);
  const data = await response.json().catch(() => ({}));
  if (typeof data.access_token !== "string" || !data.access_token) throw new Error("OAuth response had no access token");
  return data.access_token;
}

function errorMessage(data) {
  // Report errors may name a field from the request. Keep a short single line,
  // omit URLs, account IDs and credential-shaped text, and never log reports.
  const message = data?.error?.message;
  if (typeof message !== "string") return "No error message";
  return message
    .replace(/-----BEGIN[^]*?-----END[^\n]*/g, "[redacted]")
    .replace(/https?:\/\/[^\s]+|[^\s@]+@[^\s@]+|[\w.-]{40,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

async function main() {
  let flags;
  try {
    ({ values: flags } = parseArgs({ options: { key: { type: "string" }, property: { type: "string" } } }));
  } catch {
    throw new Error("Usage: node scripts/ga4-check-requests.mjs --key <service-account-json-path> --property <id>");
  }
  if (!flags.key || !/^[1-9][0-9]*$/.test(flags.property ?? "")) {
    throw new Error("Usage: node scripts/ga4-check-requests.mjs --key <service-account-json-path> --property <id>");
  }
  const entries = await exportManifest();
  const token = await accessToken(flags.key);
  const sent = new Set();
  async function check({ label, method, body }) {
    const identity = JSON.stringify([method, body]);
    if (sent.has(identity)) return;
    sent.add(identity);
    let response;
    try {
      response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${flags.property}:${method}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      console.log(`${label} · connection failed`);
      process.exitCode = 1;
      return;
    }
    const data = await response.json().catch(() => null);
    if (response.ok && data) {
      const reports = Array.isArray(data.reports) ? data.reports : [data];
      const counts = reports.map((r) => Number.isInteger(r?.rowCount) ? r.rowCount : (r?.rows?.length ?? 0));
      console.log(`${label} · HTTP ${response.status} · rows [${counts.join(", ")}]`);
    } else {
      console.log(`${label} · HTTP ${response.status} · ${errorMessage(data)}`);
      process.exitCode = 1;
    }
    return response.status;
  }
  for (const entry of entries) {
    const status = await check(entry);
    if (status === 429) return;
    if (status === 400) {
      for (const report of entry.onRejected) {
        if (await check(report) === 429) return;
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
