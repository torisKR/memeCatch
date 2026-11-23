#!/usr/bin/env node
// Compares the Next server answered directly with the same server answered
// through Axum. See README.md in this directory.
//
//   node server/parity/parity.mjs <next-base-url> <axum-base-url> <paths-file | target>...
//
// A target is a path, or "METHOD path" (default GET). No request body is sent.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import http from "node:http";

// Not compared. README.md gives the reason for each.
const IGNORED_HEADERS = new Set([
  "date",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "x-nextjs-cache",
]);

const [nextBase, axumBase, ...pathArgs] = process.argv.slice(2);
if (!nextBase || !axumBase || pathArgs.length === 0) {
  console.error("usage: parity.mjs <next-base-url> <axum-base-url> <paths-file | target>...");
  process.exit(2);
}

const targets = pathArgs
  .flatMap((arg) =>
    // "/" is a directory on disk and also the most common target.
    statSync(arg, { throwIfNoEntry: false })?.isFile()
      ? readFileSync(arg, "utf8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      : [arg],
  )
  .map((target) => {
    const [first, second] = target.split(/\s+/);
    const [method, path] = second ? [first, second] : ["GET", first];
    if (!/^[A-Z]+$/.test(method) || !/^\/[\x21-\x7e]*$/.test(path)) {
      console.error(`expected "[METHOD] /percent-encoded-path", got: ${target}`);
      process.exit(2);
    }
    return { method, path, label: `${method} ${path}` };
  });

// Both servers get the same Host header (the Next one), so Next sees the same
// request either way. Axum forwards Host unchanged.
const hostHeader = new URL(nextBase).host;

function send(base, { method, path }) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname,
        port,
        path, // sent as written, never normalized
        method,
        headers: {
          host: hostHeader,
          accept: "*/*",
          "accept-encoding": "gzip",
          "user-agent": "memecatch-parity",
        },
      },
      (response) => {
        const hash = createHash("sha256");
        let bytes = 0;
        response.on("data", (chunk) => {
          hash.update(chunk);
          bytes += chunk.length;
        });
        response.on("end", () => {
          const fields = { status: String(response.statusCode), body: `sha256:${hash.digest("hex")} (${bytes} bytes)` };
          Object.defineProperty(fields, "bytes", { value: bytes }); // not a compared field
          for (const [name, values] of Object.entries(response.headersDistinct)) {
            if (!IGNORED_HEADERS.has(name)) fields[`header ${name}`] = values.join("\n");
          }
          resolve(fields);
        });
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}

// Next streams most bodies chunked, with no length. A route Axum answers
// itself sends the same bytes with a Content-Length. Only that case is let
// through; any other Content-Length difference counts.
function sameBytesFramedWithLength(target, next, axum) {
  return (
    target.method !== "HEAD" &&
    next["header content-length"] === undefined &&
    axum["header content-length"] === String(next.bytes)
  );
}

let failed = 0;
for (const target of targets) {
  let first, viaAxum, second;
  try {
    // The first direct request also warms Next's cache. A field that differs
    // between two direct requests is not deterministic, so it cannot tell us
    // anything about the proxy and is reported as unstable instead.
    first = await send(nextBase, target);
    viaAxum = await send(axumBase, target);
    second = await send(nextBase, target);
  } catch (error) {
    failed += 1;
    console.log(`ERROR ${target.label}\n  ${error.message}`);
    continue;
  }
  const names = new Set([...Object.keys(first), ...Object.keys(viaAxum), ...Object.keys(second)]);
  const different = [];
  const unstable = [];
  for (const name of names) {
    if (first[name] !== second[name]) unstable.push(name);
    else if (first[name] === viaAxum[name]) continue;
    else if (name === "header content-length" && sameBytesFramedWithLength(target, first, viaAxum)) continue;
    else different.push(name);
  }
  if (different.length === 0) {
    const note = unstable.length ? `  (unstable in Next itself, not compared: ${unstable.join(", ")})` : "";
    console.log(`ok    ${target.label}  ${first.status}${note}`);
    continue;
  }
  failed += 1;
  console.log(`DIFF  ${target.label}`);
  for (const name of different) {
    console.log(`  ${name}\n    next: ${first[name] ?? "(absent)"}\n    axum: ${viaAxum[name] ?? "(absent)"}`);
  }
}

console.log(`\n${targets.length - failed} of ${targets.length} targets identical`);
process.exit(failed ? 1 : 0);
