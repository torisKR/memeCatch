import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(new URL("./env-manifest.json", import.meta.url), "utf8"));
const skip = new Set(["node_modules", ".next", ".git", ".omx", ".omo", "coverage", "dist"]);

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) files(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(path);
  }
  return out;
}

const used = new Set();
function collect(text) {
  const aliases = ["process\\.env"];
  for (const match of text.matchAll(/([A-Za-z_$][\w$]*)(?:\s*:[^=\n]+)?\s*=\s*process\.env\b/g)) {
    aliases.push(match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  const patterns = aliases.flatMap((alias) => [
    new RegExp(`${alias}\\.([A-Z][A-Z0-9_]*)`, "g"),
    new RegExp(`${alias}\\[['"]([A-Z][A-Z0-9_]*)['"]\\]`, "g"),
  ]);
  patterns.push(
    /(?:requiredEnv|required|seeds|configuredTimeout)\(\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?['"]([A-Z][A-Z0-9_]*)['"]/g,
  );
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) used.add(match[1]);
  }
}
for (const path of files(root)) collect(readFileSync(path, "utf8"));

function shellFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name) || name === ".github") continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      if (dir === root && !["scripts", "deploy"].includes(name) && !name.startsWith("docker-compose")) continue;
      shellFiles(path, out);
    } else if (/\.(sh|yml)$/.test(name) && (path.includes("/scripts/") || path.includes("/deploy/") || name.startsWith("docker-compose"))) {
      out.push(path);
    }
  }
  return out;
}
for (const path of shellFiles(root)) {
  const text = readFileSync(path, "utf8");
  const names = new Set();
  for (const match of text.matchAll(/\$\{?([A-Z][A-Z0-9_]*)/g)) names.add(match[1]);
  for (const name of names) {
    if (new RegExp(`(^|\\n)\\s*${name}=`).test(text)) continue;
    used.add(name);
  }
}

const declared = new Set(Object.keys(manifest));
const missing = [...used].filter((name) => !declared.has(name)).sort();
const extra = [...declared].filter((name) => !used.has(name)).sort();
if (missing.length || extra.length) {
  console.error(JSON.stringify({ missing, extra }, null, 2));
  process.exit(1);
}
for (const [name, purpose] of Object.entries(manifest)) {
  if (typeof purpose !== "string" || purpose.trim().length < 8) {
    console.error(`${name} needs a one-line purpose`);
    process.exit(1);
  }
}
console.log(`env manifest covers ${declared.size} variables`);
