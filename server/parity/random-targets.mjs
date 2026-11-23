#!/usr/bin/env node
// For a route that answers with a random target: draws from Next and from
// Axum and compares the two sets of targets, and everything else about the
// answers. See README.md in this directory.
//
//   node server/parity/random-targets.mjs <next-base-url> <axum-base-url> <path> [draws]
//
// The target is `path` of a JSON body, or the Location header of a redirect.
import http from "node:http";

const [nextBase, axumBase, path, drawsArg = "1000"] = process.argv.slice(2);
const draws = Number(drawsArg);
if (!nextBase || !axumBase || !path?.startsWith("/") || !Number.isInteger(draws) || draws < 1) {
  console.error("usage: random-targets.mjs <next-base-url> <axum-base-url> <path> [draws]");
  process.exit(2);
}

// Same list as parity.mjs, plus the header that carries the random target.
const IGNORED_HEADERS = new Set(["date", "connection", "keep-alive", "transfer-encoding", "x-nextjs-cache", "location"]);
const hostHeader = new URL(nextBase).host;

function draw(base) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname, port, path, method: "GET", headers: { host: hostHeader, accept: "*/*", "user-agent": "memecatch-parity" } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const location = response.headers.location;
          const target = location ?? JSON.parse(body).path;
          const headers = Object.entries(response.headersDistinct)
            .filter(([name]) => !IGNORED_HEADERS.has(name))
            .map(([name, values]) => `${name}: ${values.join("\n")}`)
            .sort();
          // Everything except the target: status, headers, and the body with
          // the target cut out of it.
          resolve({ target, rest: [response.statusCode, ...headers, `body: ${body.replace(target, "<target>")}`].join("\n") });
        });
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function sample(base) {
  const targets = new Set();
  const rests = new Set();
  for (let i = 0; i < draws; i += 1) {
    const { target, rest } = await draw(base);
    targets.add(target);
    rests.add(rest);
  }
  return { targets: [...targets].sort(), rests: [...rests].sort() };
}

const next = await sample(nextBase);
const axum = await sample(axumBase);
const sameTargets = JSON.stringify(next.targets) === JSON.stringify(axum.targets);
const sameRest = JSON.stringify(next.rests) === JSON.stringify(axum.rests);

console.log(`GET ${path}, ${draws} draws from each server`);
console.log(`  next: ${next.targets.length} distinct targets, ${next.rests.length} distinct status+headers+body shape`);
console.log(`  axum: ${axum.targets.length} distinct targets, ${axum.rests.length} distinct status+headers+body shape`);
console.log(`  target sets identical: ${sameTargets}`);
console.log(`  status, headers and body shape identical: ${sameRest}`);
if (!sameTargets) {
  console.log(`  only next: ${next.targets.filter((target) => !axum.targets.includes(target)).join(" ") || "-"}`);
  console.log(`  only axum: ${axum.targets.filter((target) => !next.targets.includes(target)).join(" ") || "-"}`);
}
if (!sameRest) console.log(`  next:\n${next.rests.join("\n--\n")}\n  axum:\n${axum.rests.join("\n--\n")}`);
console.log(`  targets:\n${axum.targets.map((target) => `    ${target}`).join("\n")}`);
process.exit(sameTargets && sameRest ? 0 : 1);
