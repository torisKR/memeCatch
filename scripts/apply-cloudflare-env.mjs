import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const target = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "";
const dryRun = process.argv.includes("--dry-run");
if (target !== "production" && target !== "preview") {
  console.error("Usage: node scripts/apply-cloudflare-env.mjs --env production|preview [--dry-run]");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(new URL("./cloudflare-env-manifest.json", import.meta.url), "utf8"));
const selected = manifest.entries.filter((entry) => (
  (entry.kind === "var" || entry.kind === "secret") && entry.envs.includes(target)
));
const present = selected.filter((entry) => {
  const value = process.env[entry.name];
  return typeof value === "string" && value.length > 0;
});
const secrets = present.filter((entry) => entry.kind === "secret");
const vars = present.filter((entry) => entry.kind === "var");
const missing = selected.filter((entry) => !present.includes(entry)).map((entry) => entry.name);

console.log(`target ${target}`);
console.log(`secrets ${secrets.map((entry) => entry.name).join(" ") || "(none exported)"}`);
console.log(`vars ${vars.map((entry) => entry.name).join(" ") || "(none exported)"}`);
console.log(`unset ${missing.join(" ") || "(none)"}`);
if (dryRun) process.exit(0);
if (present.length === 0) {
  console.error("No exported values matched the manifest for this environment.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const scriptName = target === "preview" ? config.env.preview.name : config.name;
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId) {
  console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be exported. Values were not printed.");
  process.exit(1);
}

if (secrets.length > 0) {
  const directory = mkdtempSync(join(tmpdir(), "memecatch-secrets-"));
  const file = join(directory, "secrets.json");
  const payload = Object.fromEntries(secrets.map((entry) => [entry.name, process.env[entry.name]]));
  try {
    writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
    const args = ["exec", "wrangler", "secret", "bulk", file];
    if (target === "preview") args.push("--env", "preview");
    const result = spawnSync("pnpm", args, {
      cwd: root,
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (vars.length === 0) process.exit(0);

const settingsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/settings`;
const current = await fetch(settingsUrl, { headers: { authorization: `Bearer ${token}` } });
const currentBody = await current.json();
if (!current.ok) {
  console.error(`Could not read Worker settings for ${scriptName} (${current.status}). Deploy the Worker once, then re-run. Response values were not printed.`);
  process.exit(1);
}
const bindings = Array.isArray(currentBody.result?.bindings) ? currentBody.result.bindings : [];
const updates = new Map(vars.map((entry) => [entry.name, process.env[entry.name]]));
const next = [];
const seen = new Set();
for (const binding of bindings) {
  if (binding.type === "plain_text" && updates.has(binding.name)) {
    next.push({ type: "plain_text", name: binding.name, text: updates.get(binding.name) });
    seen.add(binding.name);
    continue;
  }
  if (binding.type === "secret_text") {
    next.push({ type: "secret_text", name: binding.name });
    continue;
  }
  next.push(binding);
}
for (const [name, text] of updates) {
  if (!seen.has(name)) next.push({ type: "plain_text", name, text });
}
const form = new FormData();
form.set("settings", JSON.stringify({ bindings: next }));
const patched = await fetch(settingsUrl, {
  method: "PATCH",
  headers: { authorization: `Bearer ${token}` },
  body: form,
});
if (!patched.ok) {
  console.error(`Could not write Worker vars for ${scriptName} (${patched.status}). Existing secrets were left unchanged. Response values were not printed.`);
  process.exit(1);
}
console.log(`wrote ${vars.length} vars on ${scriptName}`);
