#!/usr/bin/env node
/**
 * Submit every URL in the live sitemap to IndexNow once (after a deploy).
 *
 *   node scripts/indexnow-submit-sitemap.mjs            # dry run: fetch, filter, count
 *   node scripts/indexnow-submit-sitemap.mjs --apply    # actually POST to api.indexnow.org
 *   node scripts/indexnow-submit-sitemap.mjs --sitemap ./sitemap.xml   # local file
 *
 * Only https://catchmeme.com URLs are sent, at most 10,000 per request.
 * Before --apply, check that https://catchmeme.com/{key}.txt answers with the key.
 * Output lists counts and HTTP statuses only.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_ORIGIN,
  indexNowPayloads,
  postIndexNowPayloads,
  sitemapLocs,
} from "../lib/indexnow.ts";

export const DEFAULT_SITEMAP_URL = `${INDEXNOW_ORIGIN}/sitemap.xml`;

export function parseArgs(argv) {
  const options = { apply: false, sitemap: DEFAULT_SITEMAP_URL, skipKeyCheck: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--skip-key-check") options.skipKeyCheck = true;
    else if (arg === "--sitemap") {
      const value = argv[i + 1];
      if (!value) throw new Error("--sitemap needs a URL or a file path");
      options.sitemap = value;
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function loadSitemap(source, fetchImpl) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetchImpl(source, { headers: { accept: "application/xml" } });
    if (!response.ok) throw new Error(`sitemap fetch failed: HTTP ${response.status}`);
    return response.text();
  }
  return readFile(resolve(source), "utf8");
}

async function keyFileServed(fetchImpl) {
  try {
    const response = await fetchImpl(INDEXNOW_KEY_LOCATION);
    return response.ok && (await response.text()).trim() === INDEXNOW_KEY;
  } catch {
    return false;
  }
}

export async function run(argv, { fetchImpl = fetch, log = console.log } = {}) {
  const options = parseArgs(argv);
  const xml = await loadSitemap(options.sitemap, fetchImpl);
  const locs = sitemapLocs(xml);
  const payloads = indexNowPayloads(locs);
  const accepted = payloads.reduce((sum, payload) => sum + payload.urlList.length, 0);
  const summary = {
    mode: options.apply ? "apply" : "dry-run",
    sitemap_urls: locs.length,
    accepted_urls: accepted,
    dropped_urls: locs.length - accepted,
    requests: payloads.length,
  };
  if (!options.apply) {
    log(JSON.stringify({ ...summary, note: "dry run: nothing sent. Re-run with --apply." }));
    return { ...summary, results: [] };
  }
  if (!options.skipKeyCheck && !(await keyFileServed(fetchImpl))) {
    throw new Error("key file is not served at the key location yet; deploy first");
  }
  const results = await postIndexNowPayloads(payloads, { fetchImpl, timeoutMs: 30_000 });
  const report = {
    ...summary,
    submitted_urls: results.reduce((sum, r) => sum + (r.ok ? r.urls : 0), 0),
    statuses: results.map((r) => r.status),
  };
  log(JSON.stringify(report));
  if (results.some((r) => !r.ok)) process.exitCode = 1;
  return { ...summary, results };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(`indexnow-submit-sitemap: ${error instanceof Error ? error.message : "failed"}`);
    process.exitCode = 1;
  });
}
