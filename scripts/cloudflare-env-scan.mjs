import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = [
  "app",
  "lib",
  "components",
  "scripts",
  "integrations/memecatch-chatgpt/src",
  "proxy.ts",
  "next.config.ts",
];

const SKIP = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".wrangler",
  "terraform",
  "coverage",
]);

const SOURCE = /\.(?:ts|tsx|mts|mjs|js|cjs)$/;

const PATTERNS = [
  /process\.env(?:\??\.([A-Z][A-Z0-9_]*)|\[["']([A-Z][A-Z0-9_]*)["']\])/g,
  /(?<![.\w$])env(?:\??\.([A-Z][A-Z0-9_]*)|\[["']([A-Z][A-Z0-9_]*)["']\])/g,
  /(?:process\.env|env)\s*,\s*["']([A-Z][A-Z0-9_]*)["']/g,
];

function walk(path, files) {
  let info;
  try {
    info = statSync(path);
  } catch {
    return;
  }
  if (info.isFile()) {
    if (SOURCE.test(path)) files.push(path);
    return;
  }
  if (!info.isDirectory()) return;
  for (const name of readdirSync(path)) {
    if (SKIP.has(name)) continue;
    walk(join(path, name), files);
  }
}

/** Names read from process.env or an env record. Values are relative file paths. */
export function scanEnvNames(root = process.cwd()) {
  const files = [];
  for (const entry of ROOTS) walk(join(root, entry), files);
  const hits = new Map();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const relativePath = relative(root, file);
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const name = match[1] || match[2];
        if (!name) continue;
        const paths = hits.get(name) ?? new Set();
        paths.add(relativePath);
        hits.set(name, paths);
      }
    }
  }
  return hits;
}
