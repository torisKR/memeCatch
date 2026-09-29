#!/usr/bin/env node
/** Production-build HTTP regression using a local server; never submits reviews or executes ads.
 * Prerequisites: build with the existing read-only QA preload; Node 24; port 3105 unused.
 * The preload allows production-readable data while rejecting remote mutation requests.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { access } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const origin = "http://127.0.0.1:3105";
const preload = ".local/qa-readonly-runtime-20260928.mjs";
const results = [];
let server;
let logs = "";

async function ensureFreePort() {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error("QA port 3105 is already in use; existing server left untouched.")));
    probe.listen(3105, "127.0.0.1", () => probe.close(resolve));
  });
}

async function get(path) {
  assert.ok(path.startsWith("/") && !path.startsWith("//"), "Only local relative paths are allowed");
  // Use raw HTTP: fetch overwrites sec-fetch-mode with cors even if a custom header
  // is supplied. The proxy intentionally distinguishes document requests from RSC fetches.
  return new Promise((resolve, reject) => {
    const request = httpRequest(origin + path, {
      method: "GET",
      headers: { "accept-language": "ko", cookie: "memecatch_locale=ko", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
    }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.once("error", reject);
      incoming.once("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        resolve({ response: { status: incoming.statusCode, headers }, body });
      });
    });
    request.setTimeout(30_000, () => request.destroy(new Error("Local document request timed out")));
    request.once("error", reject);
    request.end();
  });
}

function textNodes(body, tag) {
  return [...body.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "g"))].map((match) => match[1].replaceAll("&amp;", "&"));
}

async function check(name, run) {
  const details = await run();
  const result = { name, ok: true, ...details };
  results.push(result);
  console.log(JSON.stringify(result));
}

try {
  await access(preload);
  await access(".next/BUILD_ID");
  await ensureFreePort();
  server = spawn(process.execPath, ["--import", `./${preload}`, "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3105"], {
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  server.stdout.on("data", (data) => { logs = (logs + data.toString()).slice(-4000); });
  server.stderr.on("data", (data) => { logs = (logs + data.toString()).slice(-4000); });
  let startupError;
  server.once("error", (error) => { startupError = error; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError || server.exitCode !== null) throw startupError ?? new Error("QA server exited during startup");
    try {
      const response = await fetch(`${origin}/ads.txt`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Server not ready yet; retry only this local health check. */ }
    await delay(250);
  }
  assert.ok(ready, "Local server did not become ready");

  await check("ads.txt retains verified publisher", async () => {
    const { response, body } = await get("/ads.txt");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
    assert.match(body, /google\.com, pub-3004906966180197, DIRECT, f08c47fec0942fa0/);
    return { status: response.status };
  });

  let canonical;
  for (const suffix of ["", "-incorrect-slug-for-qa"]) {
    await check(`canonical consolidation ${suffix || "short-only"}`, async () => {
      const { response } = await get(`/memes/gjq95suv${suffix}`);
      assert.equal(response.status, 308);
      const target = new URL(response.headers.get("location"), origin);
      assert.equal(target.origin, origin);
      assert.match(target.pathname, /^\/memes\/gjq95suv-.+/);
      canonical = target.pathname;
      return { status: response.status, canonical };
    });
  }
  await check("canonical page has truthful visible citations", async () => {
    const { response, body } = await get(canonical);
    assert.equal(response.status, 200);
    assert.match(body, /아이워시/);
    assert.ok(body.includes("수집 기록"));
    const objects = [...body.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const page = objects.find((o) => o["@type"] === "WebPage");
    assert.ok(page && page.citation?.length === 2, "Expected the two titled sources as structured citations");
    for (const url of page.citation) assert.ok(body.includes(`href="${url.replaceAll("&", "&amp;")}"`));
    assert.ok(!objects.some((o) => o["@type"] === "VideoObject"), "No invented video upload date");
    assert.ok(!body.includes("pagead/js/adsbygoogle.js"));
    return { status: response.status, citations: page.citation.length };
  });
  await check("unknown meme retains HTTP 404", async () => {
    const { response } = await get("/memes/not-valid");
    assert.equal(response.status, 404);
    return { status: response.status };
  });

  let sitemapBody;
  await check("sitemap uses unique canonical URLs and honest static dates", async () => {
    const { response, body } = await get("/sitemap.xml");
    sitemapBody = body;
    assert.equal(response.status, 200);
    const urls = textNodes(body, "loc");
    assert.ok(urls.length > 0);
    assert.equal(new Set(urls).size, urls.length);
    const privacy = [...body.matchAll(/<url>([\s\S]*?)<\/url>/g)].find((match) => match[1].includes(`${origin}/privacy<`));
    assert.ok(privacy && !privacy[1].includes("<lastmod>"));
    return { status: response.status, uniqueUrls: urls.length };
  });
  const localized = textNodes(sitemapBody, "loc").find((url) => url.includes("/en/memes/"));
  if (localized) {
    await check("reviewed localized canonical page", async () => {
      const path = new URL(localized).pathname;
      const { response, body } = await get(path);
      assert.equal(response.status, 200);
      assert.match(body, /<html[^>]*lang="en"/);
      return { status: response.status, path };
    });
  }

  for (const path of ["/feed.xml", "/llms.txt", "/llms-full.txt"]) {
    await check(`eligible publication export ${path}`, async () => {
      const { response, body } = await get(path);
      assert.equal(response.status, 200);
      assert.ok(!body.includes("3,000+"));
      assert.ok(body.length > 100);
      if (path === "/feed.xml") {
        const links = textNodes(body, "link").filter((url) => url.includes("/memes/"));
        assert.ok(links.length > 0 && links.length <= 30);
        assert.ok(links.every((url) => /\/memes\/[a-z0-9]{8}-.+/.test(url)));
      }
      return { status: response.status, bytes: Buffer.byteLength(body) };
    });
  }
  await check("readiness desk is not public", async () => {
    const { response, body } = await get("/admin/publisher-readiness");
    const location = response.headers.get("location");
    // Next may stream a protected-page redirect. Both forms must preserve the auth return path.
    if ([307, 308].includes(response.status)) {
      const target = new URL(location, origin);
      assert.equal(target.pathname, "/login");
      assert.equal(target.searchParams.get("next"), "/admin/publisher-readiness");
    } else {
      assert.match(body, /\/login\?next=(?:%2F|\\u0026)?admin|\/login\?next=%2Fadmin%2Fpublisher-readiness/);
    }
    assert.ok(!body.includes("전체 공개 문서 수"), "Private diagnostic data must not leak");
    return { status: response.status, protected: true };
  });
  console.log(JSON.stringify({ ok: true, checks: results.length, mode: "local-production-http-read-only" }));
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  console.error("QA failed; no deployment, review request or account change was attempted.");
  console.error(JSON.stringify({ lookupQueryError: logs.includes("existence_check_failed query_error"), lookupRequestError: logs.includes("existence_check_failed request_error") }));
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
