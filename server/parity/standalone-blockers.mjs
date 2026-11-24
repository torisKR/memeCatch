#!/usr/bin/env node
// The cutover blocker list (C1): which requests an Axum without upstream
// (AXUM_NO_UPSTREAM=true) cannot answer yet, by Next route.
//
//   node server/parity/standalone-blockers.mjs <next> <axum> [--answered=<file>] [--cookie=<cookie>]
//
// It asks the Axum only (no request is sent to Next but /sitemap.xml), once
// per method each Next route exports (server/src/standalone/next_routes.json),
// at a sample path, and once per URL of Next's sitemap, plus paths no route
// matches. A `501` with `x-axum-not-ported` is a blocker. With --answered,
// the GET paths Axum did answer are written to <file> for pages/pages.mjs,
// which compares them with Next.
//
// No body is sent, so POST routes answer 400 or 401 when they are native:
// enough to tell native from not ported, and nothing is written. Signed out,
// the sign-in gate answers /admin, /my and /submit before any route; run it
// again with --cookie=<an operator's session cookie> to see those pages.
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";

const [nextBase, axumBase, ...options] = process.argv.slice(2);
if (!nextBase || !axumBase) {
  console.error("usage: standalone-blockers.mjs <next> <axum> [--answered=<file>]");
  process.exit(2);
}
const option = (name) => {
  const found = options.find((given) => given.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
};
const answeredFile = option("answered");
const cookie = option("cookie");
const host = new URL(nextBase).host;

function ask(base, method, path) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: url.hostname,
        port: url.port,
        method,
        path,
        headers: {
          host,
          accept: "text/html,*/*;q=0.8",
          // A browser's form or fetch sends it; without it some routes leave
          // the request to Next (an origin only Next can judge).
          ...(method === "GET" || method === "HEAD" ? {} : { origin: new URL(nextBase).origin }),
          ...(cookie && base === axumBase ? { cookie } : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

const sitemap = await ask(nextBase, "GET", "/sitemap.xml");
const sitemapPaths = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
  const url = new URL(match[1].replaceAll("&amp;", "&"));
  return `${url.pathname}${url.search}`;
});
const memeKey = sitemapPaths.find((path) => /^\/memes\/[^/]+$/.test(path))?.split("/")[2] ?? "zzzzzzzz";
const collection = sitemapPaths.find((path) => /^\/collections\/[^/]+$/.test(path))?.split("/")[2] ?? "x";

// A sample value for each dynamic segment.
const SAMPLES = {
  "[locale]": "en",
  "[key]": memeKey,
  "[id]": "00000000-0000-0000-0000-000000000000",
  "[token]": "x",
  "[...path]": "a/b.png",
  "[...all]": "get-session",
  "[[...slug]]": "",
};
function sample(pattern) {
  const parts = pattern.split("/").map((segment) => {
    if (segment === "[slug]") {
      if (pattern.startsWith("/collections")) return collection;
      if (pattern.startsWith("/guides")) return "usage-signals";
      return "monday-loading";
    }
    return SAMPLES[segment] ?? segment;
  });
  return parts.join("/").replace(/\/+$/, "") || "/";
}

const routes = JSON.parse(readFileSync(new URL("../src/standalone/next_routes.json", import.meta.url), "utf8"));
const requests = [];
for (const route of routes) {
  for (const method of route.methods) requests.push({ method, path: sample(route.path), route: route.path });
}
for (const path of sitemapPaths) requests.push({ method: "GET", path, route: null });
for (const path of ["/nope", "/ko", "/a/b", "/zz/explore", "/en/nope", "/api/nope", "/rankings/x", "/nope.png", "/icons", "/ar/opengraph-image/x", "/en/rankings", "/ja/rankings"]) {
  requests.push({ method: "GET", path, route: null });
}

const blockers = new Map();
const answered = new Set();
const errors = [];
for (const { method, path } of requests) {
  let answer;
  try {
    answer = await ask(axumBase, method, path);
  } catch (error) {
    errors.push(`${method} ${path}: ${error.message}`);
    continue;
  }
  const notPorted = answer.headers["x-axum-not-ported"];
  if (answer.status === 501 && notPorted) {
    const entry = blockers.get(notPorted) ?? { methods: new Set(), paths: new Set() };
    entry.methods.add(method);
    entry.paths.add(path);
    blockers.set(notPorted, entry);
  } else if (method === "GET") {
    answered.add(path);
  }
}

console.log(`${requests.length} requests, ${blockers.size} Next routes not ported:\n`);
console.log("| Next route | methods | requests | example |");
console.log("| --- | --- | --- | --- |");
for (const [route, entry] of [...blockers].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`| \`${route}\` | ${[...entry.methods].join(", ")} | ${entry.paths.size} | \`${[...entry.paths][0]}\` |`);
}
if (errors.length) console.log(`\nfailed requests:\n${errors.join("\n")}`);
if (answeredFile) {
  writeFileSync(answeredFile, `${[...answered].join("\n")}\n`);
  console.log(`\n${answered.size} GET paths Axum answered, written to ${answeredFile}`);
}
