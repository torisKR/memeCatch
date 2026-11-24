#!/usr/bin/env node
// The service worker at the cutover (C1): a visitor who has Next's Serwist
// worker installed, then the site served by Axum alone.
//
//   node server/parity/worker.mjs <next> <axum-without-upstream>
//
// One origin (a small proxy on port 3760, switched from Next to Axum while
// the browser is open), as in production. Steps and what each must show:
//   1. Next's page installs Next's worker; its precache holds /_next/static.
//   2. The proxy switches to Axum. A reload gets Axum's page; the browser
//      finds the new /sw.js, which takes over and deletes every Serwist cache.
//      No /_next/ file is asked for or answered from a cache.
//   3. Offline, a navigation shows the /offline page the new worker kept.
//   4. A new visitor on Axum's page gets the new worker and no Next cache.
// Exit code 0 when every check holds. Needs the packages of the repository
// root (@playwright/test and its Chromium).
import http from "node:http";
import { chromium } from "@playwright/test";

const [nextBase, axumBase] = process.argv.slice(2);
if (!nextBase || !axumBase) {
  console.error("usage: worker.mjs <next> <axum-without-upstream>");
  process.exit(2);
}
const PORT = 3760;
const origin = `http://127.0.0.1:${PORT}`;
const host = new URL(nextBase).host;
const target = { name: "next", url: new URL(nextBase) };
const seen = [];

const proxy = http.createServer((request, response) => {
  seen.push({ server: target.name, path: request.url });
  const upstream = http.request(
    {
      host: target.url.hostname,
      port: target.url.port,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host },
    },
    (answer) => {
      response.writeHead(answer.statusCode, answer.rawHeaders);
      answer.pipe(response);
    },
  );
  upstream.on("error", () => response.destroy());
  request.pipe(upstream);
});
await new Promise((ready) => proxy.listen(PORT, "127.0.0.1", ready));

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
}

async function until(page, script, description, timeout = 30_000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await page.evaluate(script);
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${description}`);
    await page.waitForTimeout(250);
  }
}

const cacheState = () =>
  (async () => {
    const names = await caches.keys();
    const sizes = {};
    for (const name of names) sizes[name] = (await (await caches.open(name)).keys()).length;
    return sizes;
  })();

const browser = await chromium.launch();
try {
  // 1. Next and its worker.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/about`);
  await until(page, () => navigator.serviceWorker.controller?.scriptURL, "Next's worker to control the page");
  const before = await until(
    page,
    () =>
      (async () => {
        const names = await caches.keys();
        const precache = names.find((name) => name.startsWith("serwist-precache"));
        if (!precache) return null;
        const keys = await (await caches.open(precache)).keys();
        return keys.length > 100 ? { names, precached: keys.map((request) => new URL(request.url).pathname) } : null;
      })(),
    "Next's precache",
  );
  const precachedNext = before.precached.filter((path) => path.startsWith("/_next/static/")).length;
  check("Next's worker precached its build", precachedNext > 100, `${precachedNext} /_next/static files, caches ${before.names.join(", ")}`);
  const oldScript = await page.evaluate(() => fetch("/sw.js").then((response) => response.text()));
  check("the worker is Next's Serwist build", oldScript.includes("serwist"));

  // 2. The cutover.
  target.name = "axum";
  target.url = new URL(axumBase);
  const fromCutover = seen.length;
  const answers = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin) answers.push({ path: url.pathname, fromWorker: response.fromServiceWorker() });
  });
  await page.reload();
  const html = await page.content();
  check("the reload is Axum's page", html.includes("/_axum/") && !html.includes("/_next/static"));
  const after = await until(
    page,
    () =>
      (async () => {
        const names = await caches.keys();
        return names.length === 1 && names[0] === "memecatch-offline-v1" ? names : null;
      })(),
    "the new worker to replace the old one and delete its caches",
  );
  check("every Serwist cache is gone", after.length === 1, `caches now: ${after.join(", ")}`);
  const controller = await until(
    page,
    () =>
      (async () => {
        const script = await fetch("/sw.js").then((response) => response.text());
        return navigator.serviceWorker.controller && script.includes("memecatch-offline-v1") ? navigator.serviceWorker.controller.scriptURL : null;
      })(),
    "the new worker to control the page",
  );
  check("the new worker controls the page", controller === `${origin}/sw.js`);
  await page.reload();
  const nextFiles = answers.filter((answer) => answer.path.startsWith("/_next/"));
  check("no /_next/ file was loaded after the cutover", nextFiles.length === 0, nextFiles.map((answer) => answer.path).join(" "));
  const askedNext = seen.slice(fromCutover).filter((request) => request.path.startsWith("/_next/"));
  check("no /_next/ request reached the server after the cutover", askedNext.length === 0);
  const cached = await page.evaluate(cacheState);
  check("the new worker keeps only /offline", JSON.stringify(cached) === JSON.stringify({ "memecatch-offline-v1": 1 }), JSON.stringify(cached));

  // 3. Offline.
  await context.setOffline(true);
  await page.goto(`${origin}/weekly`).catch(() => {});
  const offlineText = await page.evaluate(() => document.body?.innerText ?? "");
  const offlinePage = await new Promise((done, fail) => {
    const url = new URL(axumBase);
    http
      .get({ host: url.hostname, port: url.port, path: "/offline", headers: { host } }, (answer) => {
        const chunks = [];
        answer.on("data", (chunk) => chunks.push(chunk));
        answer.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", fail);
  });
  const offlineTitle = /<title>([^<]*)<\/title>/.exec(offlinePage)?.[1] ?? "";
  check("offline, a navigation shows /offline", (await page.title()) === offlineTitle && offlineText.length > 0, offlineTitle);
  await context.setOffline(false);
  await context.close();

  // 4. A new visitor on Axum.
  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await visitor.goto(`${origin}/about`);
  const freshController = await until(visitor, () => navigator.serviceWorker.ready.then((registration) => registration.active?.scriptURL), "a new visitor's worker");
  check("a new visitor gets the new worker", freshController === `${origin}/sw.js`);
  const freshCaches = await until(visitor, () => caches.keys().then((names) => (names.length ? names : null)), "the new visitor's cache");
  check("a new visitor has no Next cache", freshCaches.every((name) => name === "memecatch-offline-v1"), freshCaches.join(", "));
  await fresh.close();
} finally {
  await browser.close();
  proxy.close();
}

const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${checks.length - failed} of ${checks.length} checks hold`);
process.exit(failed ? 1 : 0);
