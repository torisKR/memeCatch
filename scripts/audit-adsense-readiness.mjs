#!/usr/bin/env node
/** Read-only HTTP checks. Does not run advertising JavaScript or change Google account state. */
import { pathToFileURL } from "node:url";

const PUBLISHER = "pub-3004906966180197";
const RECORD = `google.com, ${PUBLISHER}, DIRECT, f08c47fec0942fa0`;

export function inspectAdsTxtResponse({ status, contentType, body }) {
  const errors = [];
  if (status !== 200) errors.push(`HTTP status is ${status}, expected 200`);
  if (!/^text\/plain(?:\s*;|\s*$)/i.test(contentType ?? "")) errors.push("Content-Type must be text/plain");
  const records = String(body ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const expectedFields = RECORD.split(",").map((field) => field.trim());
  const found = records.some((record) => {
    const fields = record.split(",").map((field) => field.trim());
    return fields.length === 4 && fields.every((field, index) => field === expectedFields[index]);
  });
  if (!found) errors.push("Verified Google publisher record is missing or mismatched");
  return { ok: errors.length === 0, publisherId: PUBLISHER, errors, googleAccountStatus: "not_checked", googleRecrawlRequested: false };
}

async function check(url, userAgent) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      redirect: "follow", signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": userAgent, accept: "text/plain" },
    });
    const body = await response.text();
    return {
      url, userAgent, startedAt, finalUrl: response.url,
      httpStatus: response.status, contentType: response.headers.get("content-type"),
      ...inspectAdsTxtResponse({ status: response.status, contentType: response.headers.get("content-type"), body }),
    };
  } catch (error) {
    return { url, userAgent, startedAt, ok: false, errors: [error instanceof Error ? error.message : "Network error"], googleAccountStatus: "not_checked", googleRecrawlRequested: false };
  }
}

async function main() {
  if (process.argv.length > 2) throw new Error("Usage: node scripts/audit-adsense-readiness.mjs (no arguments)");
  const urls = [
    "https://catchmeme.com/ads.txt", "http://catchmeme.com/ads.txt",
    "https://www.catchmeme.com/ads.txt", "http://www.catchmeme.com/ads.txt",
  ];
  const results = [];
  for (const url of urls) results.push(await check(url, "MemeCatch-readiness-audit/1.0"));
  for (const userAgent of ["Mediapartners-Google", "AdsBot-Google", "Googlebot"]) {
    results.push(await check(urls[0], userAgent));
  }
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), mode: "read-only-http", results,
    note: "A user-agent comparison is not a request from a real Google crawler. HTTP success is not AdSense approval or proof of Google's last crawl. robots.txt and the actual account status require separate review.",
  }, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
