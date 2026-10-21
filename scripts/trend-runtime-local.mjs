import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function parseSupabaseStatusJson(raw) {
  const parsed = JSON.parse(raw);
  const apiUrl = parsed.API_URL ?? parsed.api_url;
  const serviceRoleKey = parsed.SERVICE_ROLE_KEY ?? parsed.service_role_key;
  if (typeof apiUrl !== "string" || typeof serviceRoleKey !== "string") {
    throw new Error("local_supabase_status_missing_credentials");
  }
  const url = new URL(apiUrl);
  if (!LOCAL_API_HOSTS.has(url.hostname) || url.port !== "54321" || url.protocol !== "http:") {
    throw new Error("local_supabase_url_required");
  }
  return { apiUrl: url.toString().replace(/\/$/u, ""), serviceRoleKey };
}

export function readYouTubeApiKey(raw) {
  const match = raw.match(/^YOUTUBE_API_KEY\s*=\s*(.*)$/mu);
  if (!match) throw new Error("youtube_api_key_missing");
  const value = match[1].trim().replace(/^(['"])(.*)\1$/u, "$2");
  if (!value) throw new Error("youtube_api_key_missing");
  return value;
}

export function sanitizeOutput(value, secrets) {
  return secrets.reduce(
    (safe, secret) => secret ? safe.split(secret).join("[REDACTED]") : safe,
    String(value),
  );
}

async function main() {
  if (!process.argv.includes("--live-local")) {
    throw new Error("live_local_flag_required");
  }
  const repoRoot = resolve(new URL("..", import.meta.url).pathname);
  const statusRaw = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const local = parseSupabaseStatusJson(statusRaw);
  const youtubeApiKey = readYouTubeApiKey(
    readFileSync(join(repoRoot, ".env.production"), "utf8"),
  );
  const work = mkdtempSync(join(tmpdir(), "memecatch-trend-runtime-"));
  const resultPath = join(work, "result.json");
  const run = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "scripts/trend-runtime-local.test.ts", "--reporter=dot"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MEMECATCH_LOCAL_TREND_INTEGRATION: "1",
        LOCAL_TREND_SUPABASE_URL: local.apiUrl,
        LOCAL_TREND_SERVICE_ROLE_KEY: local.serviceRoleKey,
        LOCAL_TREND_YOUTUBE_API_KEY: youtubeApiKey,
        LOCAL_TREND_RESULT_PATH: resultPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const secrets = [local.serviceRoleKey, youtubeApiKey];
  try {
    if (run.status !== 0) {
      const details = sanitizeOutput(`${run.stdout ?? ""}\n${run.stderr ?? ""}`, secrets);
      throw new Error(`local_trend_integration_failed\n${details}`);
    }
    const report = JSON.parse(await readFile(resultPath, "utf8"));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "local_trend_integration_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
